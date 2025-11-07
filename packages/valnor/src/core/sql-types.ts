import { DefaultFormatter } from "./default-formatter.js";
import { ITokenizer } from "./sql-tokenizer.js";

export type RowIn = Record<string, unknown>;
export type RowOut = Record<string, unknown>;

export type SqlBuild = {
   strings: string[];
   values?: unknown[];
};

export type SqlColumnType = string | number | boolean | null | undefined | Date | bigint | Buffer;

export type SqlBuildOptions = {
   formatter?: DefaultFormatter;
   tokenizer?: ITokenizer;
   onAddString?: (text: string) => string;
   debug?: (args: Readonly<Record<string, unknown>>) => void;
};

export type SqlRunArgs<TDbClient, TParams> = TParams extends object
   ? { db: TDbClient; params: TParams; options?: SqlBuildOptions }
   : { db: TDbClient; options?: SqlBuildOptions };

export type SqlInputArgs<TParams> = TParams extends object
   ? { params: TParams; options?: SqlBuildOptions }
   : { options?: SqlBuildOptions };

export function hasParams(value: unknown): value is { params: Record<string, unknown> } {
   if (!value) return false;
   if (typeof value !== "object") return false;
   return "params" in value;
}

export interface ISqlQueryContext {
   keyword?: string;
}

const QueryTypeValues = ["select", "update", "delete", "insert", "with", "merge"] as const;

export type QueryType = (typeof QueryTypeValues)[number];

export function isQueryType(value: string): value is QueryType {
   return QueryTypeValues.includes(value as QueryType);
}

/**
 * Checks if a value is a plain object (i.e., not an array, not null).
 * This is a type guard for Record<string, unknown>.
 *
 * @param value The value to check.
 * @returns True if the value is a plain object, false otherwise.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
   return value !== null && typeof value === "object" && !Array.isArray(value);
}
