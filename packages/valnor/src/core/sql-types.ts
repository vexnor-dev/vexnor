import { SqlParam } from "./sql-param.js";
import { SqlColumn } from "./sql-column.js";
import { Sql, SqlBuildOptions } from "./sql-base.js";

export type RowIn = object;

export type RowOut = object;

type _SqlValue_ = Sql | string | number | boolean | null | undefined | Date | bigint | Buffer;
export type SqlValue = _SqlValue_ | SqlValue[];

export type SqlParams<T> =
   T extends Record<string, unknown> ? (keyof T extends string ? SqlParam<`${keyof T}`> : never) : never;

export type SqlBuild = {
   strings: string[];
   values?: unknown[];
};

export type QueryInput = {
   name?: string | undefined;
   text: string;
   values: unknown[];
   sql: string;
};

export type SqlRunOptions<TDbClient> = {
   db: TDbClient;
   debug?: (args: Readonly<Record<string, unknown>>) => void;
};

export function isSqlRunOptions<TDbClient>(value: unknown): value is SqlRunOptions<TDbClient> {
   if (Array.isArray(value)) return false;
   if (typeof value !== "object") return false;
   if (value === null) return false;

   if (!("db" in value)) return false;
   if (!value.db) return false;
   if (typeof value.db !== "object") return false;
   if (!("query" in value.db)) return false;

   return true;
}

export type SqlRunArgs<TDbClient, TParams> = TParams extends undefined
   ? [options: TDbClient | SqlRunOptions<TDbClient>]
   : [options: TDbClient | SqlRunOptions<TDbClient>, params: TParams];

export type SqlValuesArgs<TParams> = TParams extends undefined | never
   ? { options?: SqlBuildOptions }
   : { params: TParams; options?: SqlBuildOptions };

export type SqlQueryRow<TParams extends Record<string, unknown>> = Record<keyof TParams, SqlColumn> & {
   $all: SqlColumn[];
};
