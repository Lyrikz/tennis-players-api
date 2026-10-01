import { App } from 'aws-cdk-lib';
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { TennisPlayersStack, type TennisPlayersStackProps } from '../lib/tennis-players-stack';

const API_KEY = 'test-api-key-0123456789';

function createStack(props: Partial<TennisPlayersStackProps> = {}): TennisPlayersStack {
  // Skips esbuild bundling: these tests assert on the infrastructure, not on the bundle.
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
  return new TennisPlayersStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'eu-west-3' },
    apiKey: API_KEY,
    ...props,
  });
}

function synthesize(props: Partial<TennisPlayersStackProps> = {}): Template {
  return Template.fromStack(createStack(props));
}

describe('TennisPlayersStack', () => {
  const template = synthesize();

  const apiFunction = { Description: 'Tennis players REST API (NestJS)' };
  const migrationFunction = { Description: 'Applies DynamoDB data migrations' };
  const tableRef = { Ref: Match.stringLikeRegexp('^Table') };

  describe('DynamoDB table', () => {
    it('follows the single-table design with generic keys and two GSIs', () => {
      template.resourceCountIs('AWS::DynamoDB::GlobalTable', 1);
      template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: Match.arrayWith(
          ['PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK'].map((AttributeName) => ({
            AttributeName,
            AttributeType: 'S',
          })),
        ),
        GlobalSecondaryIndexes: [
          Match.objectLike({
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          }),
          Match.objectLike({ IndexName: 'GSI2' }),
        ],
      });
    });

    it('is deleted with the stack (demo environment)', () => {
      template.hasResource('AWS::DynamoDB::GlobalTable', { DeletionPolicy: 'Delete' });
    });
  });

  describe('migrations', () => {
    it('run as a custom resource listing the migration ids', () => {
      template.hasResourceProperties('Custom::DatabaseMigrations', {
        ServiceToken: Match.anyValue(),
        migrations: ['001-seed-players', '002-init-player-id-counter'],
      });
    });

    it('use a dedicated function with read-write access to the table', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        ...migrationFunction,
        Runtime: 'nodejs24.x',
        Timeout: 300,
        Environment: { Variables: Match.objectLike({ PLAYERS_TABLE_NAME: tableRef }) },
      });
      template.hasResourceProperties('AWS::IAM::Policy', {
        Roles: [{ Ref: Match.stringLikeRegexp('^MigrationFunctionServiceRole') }],
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({ Action: Match.arrayWith(['dynamodb:BatchWriteItem']) }),
          ]),
        },
      });
    });

    it('are applied before the API function is updated', () => {
      template.hasResource('AWS::Lambda::Function', {
        Properties: Match.objectLike(apiFunction),
        DependsOn: Match.arrayWith(['Migrations']),
      });
    });
  });

  describe('API function', () => {
    it('runs the Nest application on Node.js 24 / ARM', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        ...apiFunction,
        Runtime: 'nodejs24.x',
        Architectures: ['arm64'],
        Handler: 'index.handler',
        MemorySize: 1024,
        Timeout: 10,
        LoggingConfig: { LogFormat: 'JSON', LogGroup: Match.anyValue() },
        Environment: {
          Variables: {
            NODE_ENV: 'production',
            NODE_OPTIONS: '--enable-source-maps',
            PLAYERS_TABLE_NAME: tableRef,
            API_KEY,
          },
        },
      });
    });

    it('can read the table, but only create players and draw ids', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        Roles: [{ Ref: Match.stringLikeRegexp('^ApiFunctionServiceRole') }],
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({ Action: Match.arrayWith(['dynamodb:Query', 'dynamodb:GetItem']) }),
            {
              Effect: 'Allow',
              Action: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
              Resource: { 'Fn::GetAtt': [Match.stringLikeRegexp('^Table'), 'Arn'] },
              Condition: {
                'ForAllValues:StringLike': { 'dynamodb:LeadingKeys': ['PLAYER#*', 'COUNTER'] },
              },
            },
          ]),
        },
      });
    });

    it('can never delete or batch-write', () => {
      const policies = template.findResources('AWS::IAM::Policy', {
        Properties: { Roles: [{ Ref: Match.stringLikeRegexp('^ApiFunctionServiceRole') }] },
      });

      expect(Object.keys(policies)).toHaveLength(1);
      expect(JSON.stringify(policies)).not.toMatch(/dynamodb:(DeleteItem|BatchWriteItem|\*)/);
    });
  });

  it('proxies every route of an HTTP API to the function', () => {
    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', { ProtocolType: 'HTTP' });
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: '$default' });
    template.hasResourceProperties('AWS::ApiGatewayV2::Integration', {
      IntegrationType: 'AWS_PROXY',
      PayloadFormatVersion: '2.0',
    });
  });

  it('only lets API Gateway invoke the function', () => {
    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
    });
  });

  it('exposes an auto-deployed, throttled default stage with access logs', () => {
    template.resourceCountIs('AWS::ApiGatewayV2::Stage', 1);
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: '$default',
      AutoDeploy: true,
      DefaultRouteSettings: { ThrottlingRateLimit: 50, ThrottlingBurstLimit: 100 },
      AccessLogSettings: { DestinationArn: Match.anyValue(), Format: Match.anyValue() },
    });
  });

  it('retains logs for a bounded period', () => {
    template.resourceCountIs('AWS::Logs::LogGroup', 4);
    template.allResourcesProperties('AWS::Logs::LogGroup', { RetentionInDays: 30 });
  });

  it('outputs the API and documentation URLs', () => {
    template.hasOutput('ApiUrl', {
      Value: { 'Fn::Join': ['', [Match.anyValue(), '/api/v1']] },
    });
    template.hasOutput('DocsUrl', {
      Value: { 'Fn::Join': ['', [Match.anyValue(), '/docs']] },
    });
    template.hasOutput('TableName', { Value: tableRef });
  });

  it('can be configured', () => {
    const custom = synthesize({
      logRetention: RetentionDays.ONE_WEEK,
      throttlingRateLimit: 5,
      throttlingBurstLimit: 10,
    });

    custom.allResourcesProperties('AWS::Logs::LogGroup', { RetentionInDays: 7 });
    custom.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      DefaultRouteSettings: { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 },
    });
  });

  it('matches the snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });

  describe('API key', () => {
    it('raises no error when a valid key is provided', () => {
      Annotations.fromStack(createStack()).hasNoError('*', Match.anyValue());
    });

    it.each([
      ['missing', undefined],
      ['too short', 'short'],
    ])('blocks synth and deploy with an error when the key is %s', (_, apiKey) => {
      const stack = createStack({ apiKey });

      Annotations.fromStack(stack).hasError(
        '/TestStack',
        Match.stringLikeRegexp('API_KEY must be set to a secret of at least 16 characters'),
      );
      Template.fromStack(stack).hasResourceProperties('AWS::Lambda::Function', {
        Description: 'Tennis players REST API (NestJS)',
        Environment: { Variables: Match.not(Match.objectLike({ API_KEY: Match.anyValue() })) },
      });
    });
  });
});
