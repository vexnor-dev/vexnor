import {
   AsyncQueryHandler,
   SqlCharm,
   SqlParam,
   SqlQuery,
   SqlQueryExtended,
   SqlRowType,
   SqlSelectRow,
   SqlValue,
} from "./query/index.js";
import { SqlBuildError } from "./sql-build-error.js";
import { ok } from "assert";
import { Sql } from "./sql-base.js";

type _SqlInlineValue_ = Sql | string | number | boolean | null | undefined | Date | bigint | Buffer;
export type SqlQueryToken = _SqlInlineValue_ | _SqlInlineValue_[];

// export type SqlQueryToken = SqlInlineValue | SqlTableAny | SqlTableColumnAny | SqlSelectRowAny | SqlParamAny;

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
) {
   const query = new SqlQuery({ rawStrings, rawValues });

   return new Proxy(query, {
      ownKeys(target): ArrayLike<string | symbol> {
         const rowKeys = target.row ? Object.keys(target.row).filter((k) => k.startsWith("$")) : [];
         return [...Reflect.ownKeys(target), ...rowKeys];
      },
      getOwnPropertyDescriptor(target, p: string | symbol): PropertyDescriptor | undefined {
         const prop = String(p);
         switch (true) {
            case prop.startsWith("$"):
               ok(target.row, `No SqlQuery.row: ${prop}`);

               return Reflect.getOwnPropertyDescriptor(target.row, p);
            default:
               return Reflect.getOwnPropertyDescriptor(target, p);
         }
      },
      has(target, p: string | symbol): boolean {
         const prop = String(p);
         switch (true) {
            case prop.startsWith("$"):
               ok(target.row, `No SqlQuery.row: ${prop}`);

               return Object.hasOwn(target.row, p);
            default:
               return Reflect.has(target, p);
         }
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         const prop = String(p);
         switch (true) {
            case prop.startsWith("$"):
               if (!target.row) throw new SqlBuildError(`No SqlQuery.row: ${prop}`);
               return Reflect.get(target.row, prop, receiver);
            default: {
               const result = Reflect.get(target, p, receiver);
               if (typeof result === "function") {
                  return result.bind(target);
               }

               return result;
            }
         }
      },
   }) as unknown as SqlQueryExtended<{
      Row: QueryRow<typeof rawValues>;
      Params: QueryParams<typeof rawValues>;
   }>;
}

export type InferResultRowFromQueryTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends SqlSelectRow<infer Options extends { Row: Record<string, unknown> }>
      ? Options["Row"] & InferResultRowFromQueryTokens<Rest>
      : Start extends SqlValue<infer Options extends { Key: string; Type: unknown }>
        ? Record<Options["Key"], Options["Type"]> & InferResultRowFromQueryTokens<Rest>
        : Start extends SqlRowType<infer Row>
          ? Row
          : InferResultRowFromQueryTokens<Rest>
   : unknown;

export type InferParamsFromQueryTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends SqlParam<infer Param extends { Name: string; Type: unknown }>
      ? Record<Param["Name"], Param["Type"]> & InferParamsFromQueryTokens<Rest>
      : Start extends SqlQueryExtended<infer Options extends { Params?: unknown }>
        ? Options["Params"] extends Record<string, unknown>
           ? Options["Params"] & InferParamsFromQueryTokens<Rest>
           : InferParamsFromQueryTokens<Rest>
        : Start extends SqlCharm<infer Options extends { Params?: unknown }>
          ? Options["Params"] extends Record<string, unknown>
             ? Options["Params"] & InferParamsFromQueryTokens<Rest>
             : InferParamsFromQueryTokens<Rest>
          : InferParamsFromQueryTokens<Rest>
   : unknown;

export type ExtractResultRowFromQuery<T> =
   T extends SqlQueryExtended<infer U extends { Row?: unknown }> ? U["Row"] : never;

export type ExtractParamsFromQuery<T> =
   T extends SqlQueryExtended<infer U extends { Params?: unknown }>
      ? U["Params"]
      : T extends AsyncQueryHandler<
             infer U extends { Params?: unknown; Row?: unknown; QueryResult: any; QueryClient: any }
          >
        ? U["Params"]
        : never;

export type ObjectOrUndefined<T> = keyof T extends never ? void : T;

export type QueryParams<T> = ObjectOrUndefined<InferParamsFromQueryTokens<T>>;
export type QueryRow<T> = ObjectOrUndefined<InferResultRowFromQueryTokens<T>>;
