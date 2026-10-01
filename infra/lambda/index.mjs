// ESM entry point of the Lambda bundle.
// The application is compiled by `nest build` (tsc, which emits the decorator metadata
// Nest relies on and esbuild cannot produce) into CommonJS; this file re-exports its
// handler as a named ESM export so that esbuild can emit an ESM bundle, required by
// the ESM-only NestJS 12 packages (`import.meta.url`).
export { handler } from '../../dist/lambda.js';
