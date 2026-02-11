import { AsyncQueryHandler, SqlQuery, SqlQueryExtended } from "./query/index.js";
import { Sql, ParamsOf, RowOf } from "./sql-base.js";

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

export type InferRowFromSqlTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends [infer A, ...infer B]
      ? Merge<Merge<RowOf<A>, InferRowFromSqlTokens<B>>, InferRowFromSqlTokens<Rest>>
      : Merge<RowOf<Start>, InferRowFromSqlTokens<Rest>>
   : unknown;

type Merge<A, B> = [A] extends [never]
   ? [B] extends [never]
      ? void
      : B
   : [B] extends [never]
     ? A
     : { [K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never };

export type InferParamsFromSqlTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends [infer A, ...infer B]
      ? Merge<Merge<ParamsOf<A>, InferParamsFromSqlTokens<B>>, InferParamsFromSqlTokens<Rest>>
      : Merge<ParamsOf<Start>, InferParamsFromSqlTokens<Rest>>
   : unknown;

export type QueryParams<T> = [keyof InferParamsFromSqlTokens<T>] extends [never] ? void : InferParamsFromSqlTokens<T>;
export type QueryRow<T> = InferRowFromSqlTokens<T>;

export type ExtractResultRowFromQuery<T> =
   T extends SqlQueryExtended<infer U extends { Row?: unknown }> ? U["Row"] : never;

export type ExtractParamsFromQuery<T> =
   T extends SqlQueryExtended<infer U extends { Params?: any }>
      ? U["Params"]
      : T extends AsyncQueryHandler<infer U extends { Params?: any; Row?: any; QueryResult: any; QueryClient: any }>
        ? U["Params"]
        : never;
