export { jsonMany, jsonOne } from "#src/charms/json-aggregation-duckdb.js";
export { DuckDBTokenizer } from "#src/duckdb-tokenizer.js";
export { sql } from "#src/duckdb-sql.js";
export { DuckDBQueryHandler, type DuckDBClient, type DuckDBQueryResult, PLUGIN_NAME } from "#src/duckdb-query-handler.js";
export { newDuckDBTableHandler } from "#src/crud/duckdb-table-handler.js";
export type { DuckDBTableHandler } from "#src/crud/duckdb-table-handler.js";
export { DuckDBSelectCommand, type DuckDBSelectCommandResult } from "#src/crud/duckdb-select-command.js";
export { DuckDBProjectBy } from "#src/crud/duckdb-project-by.js";
export { DuckDBUpdateCommand, type DuckDBUpdateCommandResult } from "#src/crud/duckdb-update-command.js";
export { DuckDBDeleteCommand, type DuckDBDeleteCommandResult } from "#src/crud/duckdb-delete-command.js";
export { DuckDBInsertRowsCommand, type DuckDBInsertRowsCommandResult } from "#src/crud/duckdb-insert-rows-command.js";
export { DuckDBInsertFromCommand, type DuckDBInsertFromCommandResult } from "#src/crud/duckdb-insert-from-command.js";
export { DuckDBUpsertCommand, type DuckDBUpsertCommandArgs, type DuckDBUpsertCommandResult } from "#src/crud/duckdb-upsert-command.js";
export { defaultQueryOptions } from "#src/default-query-options.js";
export { savepoint, transaction, DuckDBUnsupportedError } from "#src/duckdb-transaction.js";
export type { DuckDBConnectionConfig } from "#src/duckdb-connection-config.js";

import { vexnorDuckDB } from "#src/vexnor-duckdb.js";
export default vexnorDuckDB;
export { vexnorDuckDB, VexnorDuckDB } from "#src/vexnor-duckdb.js";

import "#src/duckdb-augment.js";
