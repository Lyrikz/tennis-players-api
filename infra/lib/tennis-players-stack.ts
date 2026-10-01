import * as path from 'node:path';
import {
  Annotations,
  CfnOutput,
  CustomResource,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib';
import { AccessLogFormat } from 'aws-cdk-lib/aws-apigateway';
import { HttpApi, HttpStage, LogGroupLogDestination } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, LoggingFormat, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';
import { MIN_API_KEY_LENGTH } from '../../src/config/app.config';
import { MIGRATIONS } from '../../src/database/migrations';
import { TableSchema } from '../../src/database/table-schema';
import { PlayerIdCounter, PlayerKeys } from '../../src/players/infrastructure/dynamodb/player.item';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

export interface TennisPlayersStackProps extends StackProps {
  /**
   * Secret expected in the `x-api-key` header of write requests, passed to the
   * function as an environment variable. Required to synthesize or deploy, but
   * not to bootstrap (an error annotation blocks `synth`, `diff` and `deploy` only).
   */
  readonly apiKey?: string;
  /** @default RetentionDays.ONE_MONTH */
  readonly logRetention?: RetentionDays;
  /** Steady-state requests per second allowed on the API. @default 50 */
  readonly throttlingRateLimit?: number;
  /** Burst of concurrent requests allowed on the API. @default 100 */
  readonly throttlingBurstLimit?: number;
}

/**
 * Serverless deployment of the API:
 * - a single-table DynamoDB table, migrated on every deployment by a custom resource;
 * - a single Lambda function running the Nest application, with read-only access to it;
 * - an API Gateway HTTP API that proxies every route to the function.
 */
export class TennisPlayersStack extends Stack {
  readonly table: TableV2;
  readonly api: HttpApi;
  readonly handler: NodejsFunction;

  private readonly logRetention: RetentionDays;

  constructor(scope: Construct, id: string, props: TennisPlayersStackProps) {
    super(scope, id, props);
    this.logRetention = props.logRetention ?? RetentionDays.ONE_MONTH;

    this.table = this.createTable();
    const migrations = this.createMigrations(this.table);

    this.handler = this.createApiFunction(this.table, this.validateApiKey(props.apiKey));
    // The new application version is only deployed once the data has been migrated.
    this.handler.node.addDependency(migrations);

    this.api = this.createHttpApi(this.handler, props);

    new CfnOutput(this, 'ApiUrl', {
      description: 'Base URL of the API',
      value: `${this.api.apiEndpoint}/api/v1`,
    });
    new CfnOutput(this, 'DocsUrl', {
      description: 'Swagger UI',
      value: `${this.api.apiEndpoint}/docs`,
    });
    new CfnOutput(this, 'TableName', {
      description: 'DynamoDB table (PLAYERS_TABLE_NAME)',
      value: this.table.tableName,
    });
  }

  /** Single-table design: generic, overloaded keys (see `src/database/table-schema.ts`). */
  private createTable(): TableV2 {
    const { partitionKey, sortKey, indexes } = TableSchema;
    const stringKey = (name: string) => ({ name, type: AttributeType.STRING });

    return new TableV2(this, 'Table', {
      partitionKey: stringKey(partitionKey),
      sortKey: stringKey(sortKey),
      // Pay per request: no idle cost for an API with sporadic traffic.
      billing: Billing.onDemand(),
      globalSecondaryIndexes: Object.values(indexes).map((index) => ({
        indexName: index.name,
        partitionKey: stringKey(index.partitionKey),
        sortKey: stringKey(index.sortKey),
      })),
      // Demo environment: the data can be rebuilt from the migrations at any time.
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }

  /**
   * `Custom::DatabaseMigrations`: runs pending migrations during `cdk deploy`.
   * Its properties list the migration ids, so adding a migration triggers an
   * update of the resource, hence a new run.
   */
  private createMigrations(table: TableV2): CustomResource {
    const migrationFunction = new NodejsFunction(this, 'MigrationFunction', {
      description: 'Applies DynamoDB data migrations',
      entry: path.join(PROJECT_ROOT, 'src/database/migrate.handler.ts'),
      projectRoot: PROJECT_ROOT,
      depsLockFilePath: path.join(PROJECT_ROOT, 'package-lock.json'),
      handler: 'handler',
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.minutes(5),
      loggingFormat: LoggingFormat.JSON,
      logGroup: this.createLogGroup('MigrationFunctionLogs'),
      environment: {
        PLAYERS_TABLE_NAME: table.tableName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      // Plain TypeScript without decorators: esbuild can bundle the sources directly.
      bundling: {
        target: 'node24',
        minify: true,
        sourceMap: true,
        // Pin the SDK version instead of relying on the one shipped with the runtime.
        bundleAwsSDK: true,
      },
    });
    table.grantReadWriteData(migrationFunction);

    const provider = new Provider(this, 'MigrationProvider', {
      onEventHandler: migrationFunction,
      logGroup: this.createLogGroup('MigrationProviderLogs'),
    });

    return new CustomResource(this, 'Migrations', {
      serviceToken: provider.serviceToken,
      resourceType: 'Custom::DatabaseMigrations',
      properties: { migrations: MIGRATIONS.map(({ id }) => id) },
    });
  }

  private validateApiKey(apiKey: string | undefined): string | undefined {
    if (apiKey === undefined || apiKey.length < MIN_API_KEY_LENGTH) {
      Annotations.of(this).addError(
        `API_KEY must be set to a secret of at least ${MIN_API_KEY_LENGTH} characters ` +
          '(shell or .env), e.g. API_KEY=$(openssl rand -hex 32) npm run cdk:deploy',
      );
      return undefined;
    }
    return apiKey;
  }

  private createApiFunction(table: TableV2, apiKey: string | undefined): NodejsFunction {
    const apiFunction = new NodejsFunction(this, 'ApiFunction', {
      description: 'Tennis players REST API (NestJS)',
      // Bundles the output of `nest build`: tsc emits the decorator metadata that
      // Nest's dependency injection and validation rely on, which esbuild cannot.
      entry: path.join(PROJECT_ROOT, 'infra/lambda/index.mjs'),
      projectRoot: PROJECT_ROOT,
      depsLockFilePath: path.join(PROJECT_ROOT, 'package-lock.json'),
      handler: 'handler',
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      // CPU scales with memory: 1 GB keeps the Nest cold start short for a negligible cost.
      memorySize: 1024,
      timeout: Duration.seconds(10),
      loggingFormat: LoggingFormat.JSON,
      logGroup: this.createLogGroup('ApiFunctionLogs'),
      environment: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--enable-source-maps',
        PLAYERS_TABLE_NAME: table.tableName,
        ...(apiKey !== undefined && { API_KEY: apiKey }),
      },
      bundling: {
        // NestJS 12 is published as ESM only.
        format: OutputFormat.ESM,
        target: 'node24',
        minify: true,
        // Nest resolves providers and logs contexts by class name.
        keepNames: true,
        sourceMap: true,
        // CommonJS dependencies bundled into an ES module still call `require`.
        banner:
          "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
        // The AWS SDK is bundled (not listed here) to pin its version.
        externalModules: [
          // Optional Nest integrations, lazily imported and not used by this API.
          '@nestjs/microservices',
          '@nestjs/microservices/*',
          '@nestjs/websockets',
          '@nestjs/websockets/*',
          '@fastify/static',
          // Serves static assets from its own directory: shipped as is, see below.
          'swagger-ui-dist',
        ],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string) => [
            `mkdir -p "${outputDir}/node_modules"`,
            `cp -R "${inputDir}/node_modules/swagger-ui-dist" "${outputDir}/node_modules/"`,
            // Source maps and ES bundles are not served by Nest: ~9 MB saved.
            `rm -f "${outputDir}"/node_modules/swagger-ui-dist/{*.map,swagger-ui-es-bundle*}`,
          ],
        },
      },
    });
    table.grantReadData(apiFunction);
    // Least privilege for writes: create players and draw ids from the counter,
    // nothing else (no deletion, no access to the migration items).
    apiFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [table.tableArn],
        conditions: {
          'ForAllValues:StringLike': {
            'dynamodb:LeadingKeys': [
              `${PlayerKeys.partitionKeyPrefix}*`,
              PlayerIdCounter.key[TableSchema.partitionKey],
            ],
          },
        },
      }),
    );
    return apiFunction;
  }

  private createHttpApi(handler: NodejsFunction, props: TennisPlayersStackProps): HttpApi {
    const api = new HttpApi(this, 'HttpApi', {
      apiName: 'tennis-players-api',
      description: 'Tennis players REST API',
      // Every route and method is proxied to Nest, which owns routing and 404s.
      defaultIntegration: new HttpLambdaIntegration('ApiIntegration', handler),
      createDefaultStage: false,
    });

    new HttpStage(this, 'DefaultStage', {
      httpApi: api,
      stageName: '$default',
      autoDeploy: true,
      // Caps the traffic, and therefore the bill, of a public unauthenticated API.
      throttle: {
        rateLimit: props.throttlingRateLimit ?? 50,
        burstLimit: props.throttlingBurstLimit ?? 100,
      },
      accessLogSettings: {
        destination: new LogGroupLogDestination(this.createLogGroup('HttpApiAccessLogs')),
        format: AccessLogFormat.jsonWithStandardFields(),
      },
    });

    return api;
  }

  private createLogGroup(id: string): LogGroup {
    return new LogGroup(this, id, {
      retention: this.logRetention,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
