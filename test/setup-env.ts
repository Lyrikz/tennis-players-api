// e2e tests run against the bundled dataset, whatever the developer's shell exports.
delete process.env.PLAYERS_TABLE_NAME;
delete process.env.DYNAMODB_ENDPOINT;

/** API key expected by write endpoints during e2e tests. */
export const TEST_API_KEY = 'e2e-test-api-key-0123456789';
process.env.API_KEY = TEST_API_KEY;
