import { SqlSelectColumnExtended } from "./sql-select-column.js";

export type InferSelectRowByResult<Select> =
   Select extends Record<string, unknown>
      ? {
           [K in keyof Select as `$${string & K}`]: K extends string
              ? SqlSelectColumnExtended<{
                   Key: K;
                   Type: Select[K];
                }>
              : never;
        }
      : never;
