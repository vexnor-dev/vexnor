import { InferSelectRowByResult } from "#/core/query/sql-query-types.js";
import { SqlSelectAll } from "#/core/query/sql-select-all.js";
import { SqlTableColumn } from "#/core/schema/sql-table-column.js";
import { SqlQueryColumn } from "#/core/query/sql-query-column.js";
import { SqlSelectValue } from "#/core/query/sql-select-value.js";
import { SqlSelectCharm } from "#/core/query/sql-charm.js";
import { SqlSelectColumn } from "#/core/query/sql-select-column.js";

export type SqlBuildToken =
   | { type: "text"; value: string }
   | { type: "param"; name: string }
   | { type: "value"; value: unknown }
   | { type: "operator"; operator: SqlOperatorToken };

export type SqlOperatorToken =
   | { type: "set"; param: string; columns: Record<string, string> }
   | { type: "insert"; param: string; columns: Record<string, string> }
   | { type: "insertCols"; param: string; columns: Record<string, string> }
   | { type: "insertValues"; param: string; keys: string[] }
   | { type: "filter"; param: string; columns: Record<string, string>; prefix?: string; suffix?: string }
   | { type: "orderBy"; param: string; columns: Record<string, string> }
   | { type: "when"; param: string; negate?: boolean; onTrue: SqlBuildToken[]; onFalse?: SqlBuildToken[] }
   | { type: "projection"; param: string; columns: Record<string, string> }
   | { type: "pagination" }
   | { type: "upsert"; param: string; columns: Record<string, string>; conflictKeys: string[]; tableName: string };

export type SqlParamFormat = (args: { name?: string; index: number }) => string;

export type SqlQueryRow<T extends { Row?: unknown; Params?: unknown }> =
   T["Row"] extends Record<string, unknown> ? InferSelectRowByResult<T["Row"]> : null;

export type SqlQueryAll<Row> = Row extends Record<string, unknown> ? SqlSelectAll<Row> : null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlColumnTargetAny = SqlRowColumnTarget<any>;

export type SqlRowColumnTarget<T extends { Key: string; Type?: unknown }> =
   | SqlTableColumn<{ Key: T["Key"]; Type: T["Type"] }>
   | SqlQueryColumn<{ Key: T["Key"]; Type: T["Type"] }>
   | SqlSelectValue<{ Key: T["Key"]; Type: T["Type"]; Params?: unknown }>
   | SqlSelectCharm<{ Key: T["Key"]; Type: T["Type"]; Params?: unknown }>
   | SqlSelectColumn<{ Key: T["Key"]; Type: T["Type"] }>;
