#!/usr/bin/env node
import { App, Tags } from 'aws-cdk-lib';
import { loadEnvFile } from '../../src/config/env-file';
import { TennisPlayersStack } from '../lib/tennis-players-stack';

const DEFAULT_REGION = 'eu-north-1';

// Local convenience: `API_KEY` (and the AWS variables) may come from `.env`.
loadEnvFile();

const app = new App();

new TennisPlayersStack(app, 'TennisPlayersApi', {
  description: 'Tennis players REST API (NestJS on AWS Lambda + API Gateway HTTP API)',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION ?? process.env.CDK_DEFAULT_REGION ?? DEFAULT_REGION,
  },
  apiKey: process.env.API_KEY?.trim() || undefined,
});

Tags.of(app).add('project', 'tennis-players-api');
Tags.of(app).add('managed-by', 'cdk');
