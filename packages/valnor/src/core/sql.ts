import { SqlParam, SqlQuery, SqlResultRow, SqlRowAny, SqlRowType } from "./query/index.js";
import { SqlColumn, SqlColumnAny, SqlSelectAll, SqlTableAny, SqlTableCallableAny } from "./schema/index.js";
import { Sql } from "./sql-base.js";
import { SqlQueryParams, SqlQueryRowOut } from "./sql-types.js";

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   strings: TemplateStringsArray,
   ...values: Tokens
): SqlQuery<{
   Row: InferRowFromQueryTokens<typeof values>;
   Params: InferParamsFromQueryTokens<typeof values>;
}> {
   return new SqlQuery(strings, values);
}

type _SqlValue_ = Sql | string | number | boolean | null | undefined | Date | bigint | Buffer;
export type SqlValue = _SqlValue_ | _SqlValue_[];

export type SqlQueryToken = SqlValue | (SqlTableAny & SqlTableCallableAny) | SqlColumnAny | SqlRowAny;

export type InferRowFromColumnArray<T> = T extends [infer Start, ...infer Rest]
   ? Start extends SqlColumn<infer Options>
      ? Record<Options["Key"], Options["Type"]> & InferRowFromColumnArray<Rest>
      : Start extends SqlSelectAll<infer Select>
        ? { [K in keyof Select]: Select[K] } & InferRowFromColumnArray<Rest>
        : InferRowFromColumnArray<Rest>
   : SqlQueryRowOut;

export type InferRowFromQueryTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends SqlResultRow<infer Columns>
      ? InferRowFromColumnArray<Columns>
      : Start extends SqlRowType<infer RowType extends Record<string, unknown>>
        ? RowType
        : InferRowFromQueryTokens<Rest>
   : SqlQueryRowOut;

export type InferParamsFromQueryTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends SqlParam<infer Name extends string, infer Type>
      ? Record<Name, Type> & InferParamsFromQueryTokens<Rest>
      : Start extends SqlQuery<infer Query extends { Params: SqlQueryParams; Row: SqlQueryRowOut }>
        ? Query["Params"] & InferParamsFromQueryTokens<Rest>
        : InferParamsFromQueryTokens<Rest>
   : SqlQueryParams;

export type InferRowFromQuery<T> = T extends SqlQuery<infer U> ? U["Row"] : never;
export type InferParamsFromQuery<T> = T extends SqlQuery<infer U> ? U["Params"] : never;
