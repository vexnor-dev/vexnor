import { InferSelectRowByResult } from "./sql-query-types.js";
import { SqlSelectAll } from "./sql-select-all.js";

export type SqlBuildToken =
   | { type: "text"; value: string }
   | { type: "param"; name: string }
   | { type: "value"; value: unknown };

export type SqlParamFormat = (args: { name?: string; index: number }) => string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValueTypeAny = ValueType<any>;

export type ValueTypeOf<T> = T extends ValueType<infer U> ? U : never;

export type ValueType<T> = { value?: T };

export function type<T>(): ValueType<T> {
   return Object.create(null);
}

export type RowType<T extends Record<string, unknown>> = {
   [K in keyof T]: ValueType<T[K]>;
};

export const TYPES = {
   String: type<string>(),
   StringArray: type<string[]>(),
   Number: type<number>(),
   NumberArray: type<number[]>(),
   Boolean: type<boolean>(),
   BooleanArray: type<boolean[]>(),
   Date: type<Date>(),
   DateArray: type<Date[]>(),
   of<T>(type: ValueType<T>): ValueType<T> {
      return type;
   },
};

export type SqlQueryRow<Row> = Row extends Record<string, unknown> ? InferSelectRowByResult<Row> : null;
export type SqlQueryAll<Row> = Row extends Record<string, unknown> ? SqlSelectAll<Row> : null;
