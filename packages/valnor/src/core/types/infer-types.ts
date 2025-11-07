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
//
// export type InferSqlColumnsByRecord<Select> =
//    Select extends Record<string, unknown>
//       ? {
//            [K in keyof Select]: K extends string
//               ? SqlColumn<{
//                    Key: K;
//                    Type: Select[K];
//                 }>
//               : never;
//         }
//       : never;
