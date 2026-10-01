/**
 * Single-table design contract, shared by the application, the migrations, the
 * integration tests and the CDK stack so that they can never drift apart.
 *
 * Keys are generic (`PK`, `SK`, `GSI1PK`…) and overloaded: their meaning depends
 * on the entity stored in the item (see `entityType`).
 *
 * | Entity    | PK            | SK           | GSI1PK    | GSI1SK       | GSI2PK         | GSI2SK       |
 * | --------- | ------------- | ------------ | --------- | ------------ | -------------- | ------------ |
 * | Player    | `PLAYER#<id>` | `PROFILE`    | `PLAYERS` | `RANK#<rank>`| `COUNTRY#<cc>` | `RANK#<rank>`|
 * | Migration | `MIGRATIONS`  | `<id>`       |           |              |                |              |
 * | Counter   | `COUNTER`     | `<entity>`   |           |              |                |              |
 *
 * This module must stay dependency-free: it is imported by the CDK app.
 */
export const TableSchema = {
  partitionKey: 'PK',
  sortKey: 'SK',
  entityType: 'entityType',
  indexes: {
    /** All players, sorted by official rank. */
    byRank: { name: 'GSI1', partitionKey: 'GSI1PK', sortKey: 'GSI1SK' },
    /** Players of a country, sorted by official rank. */
    byCountry: { name: 'GSI2', partitionKey: 'GSI2PK', sortKey: 'GSI2SK' },
  },
} as const;
