import { SqlDefault } from "./sql-default.js";
import { SqlParam } from "./sql-param.js";
import { SqlColumn } from "./sql-column.js";
import { Sql } from "./sql-base.js";

export type RowIn = object;

export type RowOut = Record<string, unknown>;

export type InsertValues<T extends RowIn> = { [K in keyof T]: T[K] | SqlDefault };

type _SqlValue_ = Sql | string | number | boolean | null | undefined | Date | bigint | Buffer;
export type SqlValue = _SqlValue_ | SqlValue[];

export type SqlParams<T> =
   T extends Record<string, unknown> ? (keyof T extends string ? SqlParam<`${keyof T}`> : never) : never;

export type SqlBuild = {
   strings: string[];
   values?: unknown[];
};

export type SqlRunArgs<TDb, TParams> = TParams extends undefined ? [db: TDb] : [db: TDb, params: TParams];
export type SqlValuesArgs<TParams> = TParams extends undefined | never ? [] : [params: TParams];

export type SqlQueryRow<TParams extends Record<string, unknown>> = Record<keyof TParams, SqlColumn> & {
   $all: SqlColumn[];
};
