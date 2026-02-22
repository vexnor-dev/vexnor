import { InferSelectRowByResult } from "./sql-query-types.js";
import { SqlSelectAll } from "./sql-select-all.js";
import { SqlTableColumn } from "../schema/index.js";
import { SqlSelectValue } from "./sql-select-value.js";
import { SqlSelectCharm } from "./sql-charm.js";
import { SqlSelectColumn } from "./sql-select-column.js";
import { SqlSelectField } from "./sql-select-field.js";

export type SqlBuildToken =
   | { type: "text"; value: string }
   | { type: "param"; name: string }
   | { type: "value"; value: unknown };

export type SqlParamFormat = (args: { name?: string; index: number }) => string;

export type SqlQueryRow<T extends { Row?: unknown; Params?: unknown }> =
   T["Row"] extends Record<string, unknown> ? InferSelectRowByResult<T["Row"]> : null;

export type SqlQueryAll<Row> = Row extends Record<string, unknown> ? SqlSelectAll<Row> : null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlColumnTargetAny = SqlColumnTarget<any>;

export type SqlColumnTarget<T extends { Key: string; Type?: unknown }> =
   | SqlTableColumn<{ Key: T["Key"]; Type: T["Type"] }>
   | SqlSelectColumn<{ Key: T["Key"]; Type: T["Type"] }>
   | SqlSelectValue<{ Key: T["Key"]; Type: T["Type"]; Params?: unknown }>
   | SqlSelectCharm<{ Key: T["Key"]; Type: T["Type"]; Params?: unknown }>
   | SqlSelectField<{ Key: T["Key"]; Type: T["Type"] }>;
