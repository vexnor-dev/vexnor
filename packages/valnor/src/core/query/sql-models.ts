import { InferSelectRowByResult } from "./sql-query-types.js";
import { SqlSelectAll } from "./sql-select-all.js";

export type SqlBuildToken =
   | { type: "text"; value: string }
   | { type: "param"; name: string }
   | { type: "value"; value: unknown };

export type SqlParamFormat = (args: { name?: string; index: number }) => string;

export type SqlQueryRow<Row> = Row extends Record<string, unknown> ? InferSelectRowByResult<Row> : null;
export type SqlQueryAll<Row> = Row extends Record<string, unknown> ? SqlSelectAll<Row> : null;
