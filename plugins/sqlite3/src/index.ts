import { VexnorSqlite3 } from "#src/vexnor-sqlite3.js";

export * from "#src/charms/json-aggregation-sqlite3.js";
export { Sqlite3Tokenizer } from "#src/sqlite3-tokenizer.js";
export { Sqlite3Formatter } from "#src/sqlite3-formatter.js";
export { sql } from "#src/sqlite3-sql.js";
export { Sqlite3SelectCommand, type Sqlite3SelectCommandResult } from "#src/crud/sqlite3-select-command.js";
export { Sqlite3UpdateCommand, type Sqlite3UpdateCommandResult } from "#src/crud/sqlite3-update-command.js";
export { Sqlite3DeleteCommand, type Sqlite3DeleteCommandResult } from "#src/crud/sqlite3-delete-command.js";
export { Sqlite3InsertRowsCommand, type Sqlite3InsertRowsCommandResult } from "#src/crud/sqlite3-insert-rows-command.js";
export { Sqlite3InsertFromCommand, type Sqlite3InsertFromCommandResult } from "#src/crud/sqlite3-insert-from-command.js";
export { Sqlite3UpsertCommand, type Sqlite3UpsertCommandArgs, type Sqlite3UpsertCommandResult } from "#src/crud/sqlite3-upsert-command.js";
export { newSqlite3TableHandler } from "#src/crud/sqlite3-table-handler.js";
export { BetterSqlite3QueryHandler } from "#src/better-sqlite3-query-handler.js";
export { transaction, savepoint } from "#src/sqlite3-transaction.js";
export type { Sqlite3TransactionOptions, Sqlite3TransactionBehavior } from "#src/sqlite3-transaction.js";

export default new VexnorSqlite3();

import "#src/sqlite3-augment.js";
