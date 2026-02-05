import {
   AsyncQueryHandler,
   SqlCharm,
   SqlParam,
   SqlQuery,
   SqlQueryExtended,
   SqlRowType,
   SqlSelectRow,
   SqlSelectValue,
} from "./query/index.js";
import { Sql } from "./sql-base.js";

type _SqlInlineValue_ = Sql | string | number | boolean | null | undefined | Date | bigint | Buffer;
export type SqlQueryToken = _SqlInlineValue_ | _SqlInlineValue_[];

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   rawStrings: TemplateStringsArray,
   ...rawValues: Tokens
): SqlQueryExtended<{
   Params: QueryParams<typeof rawValues>;
   Row: QueryRow<typeof rawValues>;
}> {
   const query = new SqlQuery({ rawStrings, rawValues });

   return new Proxy(query, {
      ownKeys(target): ArrayLike<string | symbol> {
         const rowKeys = target.row ? Object.keys(target.row) : [];
         return [...Reflect.ownKeys(target), ...rowKeys];
      },
      getOwnPropertyDescriptor(target, p: string | symbol): PropertyDescriptor | undefined {
         if (Reflect.has(target, p)) return Reflect.getOwnPropertyDescriptor(target, p);
         if (target.row && Reflect.has(target.row, p)) return Reflect.getOwnPropertyDescriptor(target.row, p);

         return undefined;
      },
      has(target, p: string | symbol): boolean {
         if (Reflect.has(target, p)) return true;
         if (target.row && Reflect.has(target.row, p)) return true;

         return false;
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         if (Reflect.has(target, p)) return Reflect.get(target, p, receiver);
         if (target.row && Reflect.has(target.row, p)) return Reflect.get(target.row, p, receiver);

         return undefined;
      },
   }) as SqlQueryExtended<{
      Row: QueryRow<typeof rawValues>;
      Params: QueryParams<typeof rawValues>;
   }>;
}

export type InferResultRowFromQueryTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends SqlSelectRow<infer Options extends { Row: Record<string, unknown> }>
      ? Merge<Options["Row"], InferResultRowFromQueryTokens<Rest>>
      : Start extends SqlSelectValue<infer Options extends { Key: string; Type: unknown }>
        ? Merge<Record<Options["Key"], Options["Type"]>, InferResultRowFromQueryTokens<Rest>>
        : Start extends SqlRowType<infer Row>
          ? Merge<Row, InferResultRowFromQueryTokens<Rest>>
          : InferResultRowFromQueryTokens<Rest>
   : unknown;

export type InferParamFromSql<Start> =
   Start extends SqlParam<infer Options extends { Name: string; Type: unknown }>
      ? Record<Options["Name"], Options["Type"]>
      : Start extends SqlQueryExtended<infer Options extends { Params: Record<string, unknown> }>
        ? Options["Params"]
        : Start extends AsyncQueryHandler<
               infer Options extends { Params: Record<string, unknown>; QueryResult: any; QueryClient: any }
            >
          ? Options["Params"]
          : Start extends SqlSelectValue<
                 infer Options extends { Key: string; Type: unknown; Params: Record<string, unknown> }
              >
            ? Options["Params"]
            : Start extends SqlCharm<infer Options extends { Params: Record<string, unknown> }>
              ? Options["Params"]
              : object;

type Merge<A, B> = [A] extends [never]
   ? [B] extends [never]
      ? void
      : B
   : [B] extends [never]
     ? A
     : { [K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never };

type MergeAll<T> = T extends [infer First, ...infer Rest] ? Merge<First, MergeAll<Rest>> : object;

export type InferParamsFromQueryTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends [infer A, ...infer B]
      ? MergeAll<[InferParamFromSql<A>, InferParamsFromQueryTokens<B>, InferParamsFromQueryTokens<Rest>]>
      : MergeAll<[InferParamFromSql<Start>, InferParamsFromQueryTokens<Rest>]>
   : object;

export type ObjectOrUndefined<T> = T extends Record<string, unknown> ? ([keyof T] extends [never] ? void : T) : void;

export type QueryParams<T> = [keyof InferParamsFromQueryTokens<T>] extends [never]
   ? void
   : InferParamsFromQueryTokens<T>;
export type QueryRow<T> = InferResultRowFromQueryTokens<T>;

export type ExtractResultRowFromQuery<T> =
   T extends SqlQueryExtended<infer U extends { Row?: unknown }> ? U["Row"] : never;

export type ExtractParamsFromQuery<T> =
   T extends SqlQueryExtended<infer U extends { Params?: any }>
      ? U["Params"]
      : T extends AsyncQueryHandler<infer U extends { Params?: any; Row?: any; QueryResult: any; QueryClient: any }>
        ? U["Params"]
        : never;
