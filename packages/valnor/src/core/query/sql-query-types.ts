import { SqlSelectColumn } from "./sql-select-column.js";
import { DefaultFormatter } from "../default-formatter.js";
import { DefaultTokenizer } from "../default-tokenizer.js";
import { SqlSelectValue } from "./sql-select-value.js";

export type InferSelectRowByResult<Select> =
   Select extends Record<string, unknown>
      ? {
           [K in keyof Select as `$${string & K}`]: K extends string
              ?
                   | SqlSelectColumn<{
                        Key: K;
                        Type: Select[K];
                     }>
                   | SqlSelectValue<{ Key: K; Type: Select[K] }>
              : never;
        }
      : never;

export type SqlBuildOptions = {
   formatter?: DefaultFormatter;
   tokenizer?: DefaultTokenizer;
   onAddString?: (text: string) => string;
   debug?: (args: Readonly<Record<string, unknown>>) => void;
};

export type SqlRunArgs<Connection, Params> = Params extends object
   ? { db: Connection; params: Params; options?: SqlBuildOptions }
   : { db: Connection; options?: SqlBuildOptions };

export type SqlInputArgs<Params> = Params extends object
   ? { params: Params; options?: SqlBuildOptions }
   : { options?: SqlBuildOptions };

export function hasParams(value: unknown): value is { params: Record<string, unknown> } {
   if (!value) return false;
   if (typeof value !== "object") return false;
   return "params" in value;
}
