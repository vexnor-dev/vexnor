import { VexnorSqlite3 } from "#src/vexnor-sqlite3.js";

export * from "#src/charms/json-aggregation-sqlite3.js";
export { Sqlite3Tokenizer } from "#src/sqlite3-tokenizer.js";
export { Sqlite3Formatter } from "#src/sqlite3-formatter.js";
export { sql } from "#src/sqlite3-sql.js";
export { sqlite3InsertRows } from "#src/crud/sqlite3-insert-rows.js";
export { sqlite3InsertFrom } from "#src/crud/sqlite3-insert-from.js";
export { sqlite3Update } from "#src/crud/sqlite3-update.js";
export { sqlite3Delete } from "#src/crud/sqlite3-delete.js";
export { sqlite3Select } from "#src/crud/sqlite3-select.js";
export { sqlite3Upsert } from "#src/crud/sqlite3-upsert.js";
export { newSqlite3TableHandler } from "#src/crud/sqlite3-table-handler.js";
export { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
export { transaction, savepoint } from "#src/sqlite3-transaction.js";
export type { Sqlite3TransactionOptions, Sqlite3TransactionBehavior } from "#src/sqlite3-transaction.js";

export default new VexnorSqlite3();

import "#src/sqlite3-augment.js";
