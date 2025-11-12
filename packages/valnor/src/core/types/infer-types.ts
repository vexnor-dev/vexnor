import { SqlTableColumn } from "../schema/index.js";

export type InferTableColumnsByRecord<Select> =
   Select extends Record<string, unknown>
      ? {
           [K in keyof Select]: K extends string
              ? SqlTableColumn<{
                   Key: K;
                   Type: Select[K];
                }>
              : never;
        }
      : never;

export type NullWhenUnknown<T> = T extends unknown ? null : T;
