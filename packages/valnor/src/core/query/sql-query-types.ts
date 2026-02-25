import { SqlRowColumn } from "./sql-row-column.js";
import { DefaultFormatter } from "../default-formatter.js";
import { DefaultTokenizer } from "../default-tokenizer.js";
import { SqlLanguage } from "sql-formatter";
import { SqlParamFormat } from "./sql-models.js";
import { SqlParamAny } from "./sql-param.js";
import { Sql } from "../sql-base.js";

export type InferSelectRowByResult<Row> =
   Row extends Record<string, unknown>
      ? {
           [K in keyof Row as `$${string & K}`]: K extends string
              ? SqlRowColumn<{
                   Key: K;
                   Type: Row[K];
                }>
              : never;
        }
      : never;

export interface SqlBuildOptions {
   formatter?: DefaultFormatter;
   tokenizer?: DefaultTokenizer;
   onAddString?: (text: string) => string;
   debug?: (args: Readonly<Record<string, unknown>>) => void;
   dialect?: SqlLanguage;
   paramFormat?: SqlParamFormat;
}

export type SqlRunArgs<Connection, Params> = [keyof Params] extends [never]
   ? { db: Connection; options?: SqlBuildOptions }
   : { db: Connection; params: Params; options?: SqlBuildOptions };

export type SqlInputArgs<Params> = [keyof Params] extends [never]
   ? { options?: SqlBuildOptions }
   : unknown extends Params
     ? { params?: Params; options?: SqlBuildOptions }
     : { params: Params; options?: SqlBuildOptions };

export function hasParams(value: unknown): value is { params: Record<string, SqlParamAny> } {
   if (!value) return false;
   if (typeof value !== "object") return false;
   return "params" in value;
}

export function hasRow(value: unknown): value is { row: Record<string, Sql> } {
   if (!value) return false;
   if (!(value instanceof Sql)) return false;
   return "row" in value;
}
