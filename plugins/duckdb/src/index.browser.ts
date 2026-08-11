export { jsonMany, jsonOne } from "#src/charms/json-aggregation-duckdb.js";
export { DuckDBTokenizer } from "#src/duckdb-tokenizer.js";
export { sql } from "#src/duckdb-sql.js";
export { DuckDBQueryHandler, type DuckDBClient, type DuckDBQueryResult, PLUGIN_NAME } from "#src/duckdb-query-handler.js";
export { newDuckDBTableHandler } from "#src/crud/duckdb-table-handler.js";
export type { DuckDBTableHandler } from "#src/crud/duckdb-table-handler.js";
export { defaultQueryOptions } from "#src/default-query-options.js";
export type { DuckDBConnectionConfig } from "#src/duckdb-connection-config.js";

import "#src/duckdb-augment.js";
