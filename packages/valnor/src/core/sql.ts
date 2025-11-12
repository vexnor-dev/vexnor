import {
   InferSelectRowByResult,
   SqlCharm,
   SqlParam,
   SqlQuery,
   SqlRowType,
   SqlSelectRow,
   SqlSelectRowAny,
} from "./query/index.js";
import { SqlTableAny, SqlTableColumnAny } from "./schema/index.js";
import { Sql } from "./sql-base.js";
import { SqlBuildError } from "./sql-build-error.js";

type _SqlValue_ = Sql | string | number | boolean | null | undefined | Date | bigint | Buffer;
type SqlValue = _SqlValue_ | _SqlValue_[];

export type SqlQueryToken = SqlValue | SqlTableAny | SqlTableColumnAny | SqlSelectRowAny;

export type SqlQueryExtended<T extends { Row: unknown; Params: unknown }> = SqlQuery<{
   Row: T["Row"];
   Params: T["Params"];
}> &
   (T["Row"] extends Record<string, unknown> ? InferSelectRowByResult<T["Row"]> : unknown);

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
): SqlQueryExtended<{
   Row: ObjectOrUndefined<InferResultRowFromQueryTokens<typeof rawValues>>;
   Params: ObjectOrUndefined<InferParamsFromQueryTokens<typeof rawValues>>;
}> {
   const query = new SqlQuery({ rawStrings, rawValues });

   return new Proxy(query, {
      ownKeys(target: SqlQuery<{ Row?: unknown; Params?: unknown }>): ArrayLike<string | symbol> {
         const rowKeys = target.row ? Object.keys(target.row) : [];
         return [...Reflect.ownKeys(target), ...rowKeys];
      },
      getOwnPropertyDescriptor(target, p: string | symbol): PropertyDescriptor | undefined {
         const prop = String(p);
         switch (true) {
            case !prop.startsWith("$"):
            case prop.startsWith("$$"):
               return Reflect.getOwnPropertyDescriptor(target, p);
            case prop.startsWith("$"):
               if (!target.row) throw new SqlBuildError(`No SqlQuery.row: ${prop}`);
               return Reflect.getOwnPropertyDescriptor(target.row, p);
            default:
               throw new Error(`Unknown property: ${prop}`);
         }
      },
      has(target, p: string | symbol): boolean {
         const prop = String(p);
         switch (true) {
            case !prop.startsWith("$"):
            case prop.startsWith("$$"):
               return Object.hasOwn(target, p);
            case prop.startsWith("$"):
               if (!target.row) throw new SqlBuildError(`No SqlQuery.row: ${prop}`);
               return Object.hasOwn(target.row, p);
            default:
               throw new Error(`Unknown property: ${prop}`);
         }
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         const prop = String(p);
         switch (true) {
            case !prop.startsWith("$"):
            case prop.startsWith("$$"): {
               const result = Reflect.get(target, p, receiver);
               if (typeof result === "function") {
                  return result.bind(target);
               }
               return result;
            }
            case prop.startsWith("$"):
               if (!target.row) throw new SqlBuildError(`No SqlQuery.row: ${prop}`);
               return Reflect.get(target.row, prop.substring(1), receiver);
            default:
               throw new Error(`Unknown property: ${prop}`);
         }
      },
   }) as unknown as SqlQueryExtended<{
      Row: ObjectOrUndefined<InferResultRowFromQueryTokens<typeof rawValues>>;
      Params: ObjectOrUndefined<InferParamsFromQueryTokens<typeof rawValues>>;
   }>;
}

//
// export type InferRowFromColumns<T> = T extends [infer Start, ...infer Rest]
//    ? Start extends SqlOutKey<infer Options>
//       ? Record<Options["Key"], Options["Type"]> & InferRowFromColumns<Rest>
//       : Start extends SqlOutRow<infer Select>
//         ? { [K in keyof Select]: Select[K] } & InferRowFromColumns<Rest>
//         : InferRowFromColumns<Rest>
//    : unknown;

export type InferResultRowFromQueryTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends SqlSelectRow<infer Options extends { Row: Record<string, unknown> }>
      ? Options["Row"]
      : Start extends SqlRowType<infer Row>
        ? Row
        : InferResultRowFromQueryTokens<Rest>
   : unknown;

export type InferParamsFromQueryTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends SqlParam<infer Param extends { Name: string; Type: unknown }>
      ? Record<Param["Name"], Param["Type"]> & InferParamsFromQueryTokens<Rest>
      : Start extends SqlQuery<infer Options extends { Params: Record<string, unknown> }>
        ? Options["Params"] & InferParamsFromQueryTokens<Rest>
        : Start extends SqlCharm<infer Options extends { Params: Record<string, unknown> }>
          ? Options["Params"] & InferParamsFromQueryTokens<Rest>
          : InferParamsFromQueryTokens<Rest>
   : unknown;

export type InferResultRowFromQuery<T> = T extends SqlQuery<infer U> ? U["Row"] : never;
export type InferParamsFromQuery<T> = T extends SqlQuery<infer U> ? U["Params"] : never;

export type ObjectOrUndefined<T> = keyof T extends never ? void : T;
