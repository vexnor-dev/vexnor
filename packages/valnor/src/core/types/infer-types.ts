import { SqlTableColumn } from "../schema/index.js";

export type InferTable$RowBySelect<Select> =
   Select extends Record<string, unknown>
      ? {
           [K in keyof Select as `$${string & K}`]: K extends string
              ? SqlTableColumn<{
                   Key: K;
                   Type: Select[K];
                }>
              : never;
        }
      : never;
