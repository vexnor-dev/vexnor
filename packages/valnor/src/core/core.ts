// logger
export { logger } from "#/logger.js";

// sql template tag & types
export { sql, type SqlRow, type SqlParams, type SqlQueryToken } from "./sql.js";

// base
export { Sql, type ParamsOf, type RowOf, type TypeOf, type ArgsOf, type ParamsOfArgs } from "./sql-base.js";
export { SqlBuildError } from "./sql-build-error.js";

// query
export { SqlQuery, type SqlQueryAny, type SqlQueryExtended, type SqlQueryExtendedAny } from "./query/sql-query.js";
export { SqlQueryHandler, type SqlQueryHandlerAny, newSqlQueryHandler } from "./query/sql-query-handler.js";
export { SqlQueryRef, type SqlQueryRefAny, type SqlQueryRefExtended } from "./query/sql-query-ref.js";
export { param, SqlParam, type SqlParamAny } from "./query/sql-param.js";
export { row, SqlSelectRow, type SqlSelectRowAny } from "./query/sql-select-row.js";
export { val, SqlSelectValue, type SqlSelectValueAny } from "./query/sql-select-value.js";
export { raw, quote, SqlRaw } from "./query/sql-raw.js";
export { DEFAULT } from "./query/sql-default.js";
export { expand, SqlExpand, type SqlExpandHandler, type SqlExpandHandlerAny } from "./query/sql-expand.js";
export { input, SqlInput, type SqlInputExtended } from "./query/sql-input.js";
export { t, SqlType } from "./query/sql-type.js";
export { info, SqlQueryInfo, type SqlQueryInfoOptions } from "./charms/sql-query-info.js";
export {
   type SqlQueryFormat,
   type SqlQueryType,
   type SqlQueryScope,
   type SqlQueryOptions,
   type SqlRunArgs,
   type SqlInputArgs,
} from "./query/sql-query-types.js";
export { type SqlBuildToken, type SqlParamFormat, type SqlQueryRow, type SqlQueryAll } from "./query/sql-models.js";

// schema
export {
   SqlTable,
   newSqlTable,
   type SqlTableAny,
   type SqlTableExtended,
   type SqlTableOptions,
} from "./schema/sql-table.js";
export { SqlTableColumn, newSqlTableColumn, type SqlTableColumnAny } from "./schema/sql-table-column.js";
export { type SqlTableIdentity } from "./schema/sql-table-identity.js";
export { type ValuesOf, type JsonRow } from "./schema/schema-types.js";

// types
export { type InferTable$RowBySelect } from "./types/infer-types.js";

// charms
export { SqlCharm, SqlSelectCharm, type SqlCharmAny } from "./query/sql-charm.js";
export { col, SqlSelectColumn, type SqlSelectColumnArgs } from "./query/sql-select-column.js";

// builder
export { SqlBuildContext, type SqlBuildContextArgs } from "./builder/sql-build-context.js";
export { DefaultTokenizer } from "./builder/default-tokenizer.js";
export {
   DefaultFormatter,
   type SqlTableFormat,
   type SqlColumnFormat,
   type SqlSelectFormat,
} from "./builder/default-formatter.js";
export { type SqlBuildOptions } from "./builder/sql-build-options.js";

// constants
export { MAJOR_KEYWORDS, SUBQUERY_STARTERS } from "./sql-constants.js";

// utils
export { quoteText } from "./utils/quote-text.js";
export { Void } from "./utils/utility-types.js";

// param internals
export { type BuildSqlParams } from "./query/sql-param.js";
export { type PARAMS, type ROW, type TYPE, type ARGS } from "./sql-base.js";
export { SqlQueryColumn, newSqlSelectColumn, type SqlQueryColumnAny } from "./query/sql-query-column.js";
export { rowType, SqlRowType, type SqlRowTypeAny } from "./query/sql-row-type.js";

// crud
export { expandInsertColumns, expandInsertValues } from "./crud/sql-crud-helper.js";
export type { SqlInsertRowsResult, SqlInsertRowsParams, sqlInsertRows } from "./crud/sql-insert-rows.js";
export type { SqlInsertFromResult, SqlInsertFromArgs, sqlInsertFrom } from "./crud/sql-insert-from.js";
export { buildUpdateSetExpand } from "./crud/sql-update.js";
export type { SqlUpdateArgs, SqlUpdateParameters, SqlTableUpdateResult } from "./crud/sql-update.js";
export type { SqlDeleteArgs, SqlDeleteResult } from "./crud/sql-delete.js";
export {
   sqlSelect,
   expandFromClause,
   type SqlSelectArgs,
   type SqlSelectResult,
   type SqlSelectResultRow,
} from "./crud/sql-select.js";
export type { SqlCrudCommands } from "./crud/sql-crud-commands.js";
export { sqlCrud, newSqlTableCrud, type SqlTableCrudCrudProvider } from "./crud/sql-table-crud.js";
export { isPrimitive, type Primitive } from "#/lib/primitive.js";
export { isError } from "#/lib/is-error.js";
export { SqlRunError } from "./sql-run-error.js";
