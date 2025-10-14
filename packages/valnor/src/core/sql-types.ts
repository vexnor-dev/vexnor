import { SqlParam } from "./query/index.js";
import { SqlFormatter } from "./sql-formatter.js";
import { ITokenizer } from "./sql-tokenizer.js";

export type RowIn = object;

export type RowOut = object;

export type Params = Record<string, unknown>;

export type SqlParams<T> =
   T extends Record<string, unknown> ? (keyof T extends string ? SqlParam<`${keyof T}`> : never) : never;

export type SqlBuild = {
   strings: string[];
   values?: unknown[];
};

export type SqlBuildOptions = {
   onAddString?: (text: string) => string;
   debug?: (args: Readonly<Record<string, unknown>>) => void;
};

export type SqlRunArgs<TDbClient, TParams> = TParams extends undefined
   ? { db: TDbClient; options?: SqlBuildOptions }
   : { db: TDbClient; params: TParams; options?: SqlBuildOptions };

export type SqlInputArgs<TParams> = TParams extends undefined
   ? { options?: SqlBuildOptions; config?: SqlQueryConfig }
   : { params: TParams; options?: SqlBuildOptions; config?: SqlQueryConfig };

export type SqlQueryConfig = { formatter?: SqlFormatter; tokenizer?: ITokenizer };

export type JsonRow<T> =
   T extends Record<string, unknown> ? { [K in keyof T]: T[K] extends Date ? string : T[K] } : never;

export function hasParams(value: unknown): value is { params: Record<string, unknown> } {
   if (!value) return false;
   if (typeof value !== "object") return false;
   return "params" in value;
}

export interface ISqlQueryContext {
   keyword?: string;
}
