import { SqlCharm, SqlParam, SqlQuery, SqlRowType, SqlSelectRow, SqlSelectRowAny } from "./query/index.js";
import { SqlTableColumnAny, SqlTableAny } from "./schema/index.js";
import { Sql } from "./sql-base.js";

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   strings: TemplateStringsArray,
   ...values: Tokens
): SqlQuery<{
   Row: ObjectOrUndefined<InferRowFromQueryTokens<typeof values>>;
   Params: ObjectOrUndefined<InferParamsFromQueryTokens<typeof values>>;
}> {
   return new SqlQuery(strings, values);
}

type _SqlValue_ = Sql | string | number | boolean | null | undefined | Date | bigint | Buffer;
type SqlValue = _SqlValue_ | _SqlValue_[];

export type SqlQueryToken = SqlValue | SqlTableAny | SqlTableColumnAny | SqlSelectRowAny;
//
// export type InferRowFromColumns<T> = T extends [infer Start, ...infer Rest]
//    ? Start extends SqlOutKey<infer Options>
//       ? Record<Options["Key"], Options["Type"]> & InferRowFromColumns<Rest>
//       : Start extends SqlOutRow<infer Select>
//         ? { [K in keyof Select]: Select[K] } & InferRowFromColumns<Rest>
//         : InferRowFromColumns<Rest>
//    : unknown;

export type InferRowFromQueryTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends SqlSelectRow<infer Options extends { Row: Record<string, unknown> }>
      ? Options["Row"]
      : Start extends SqlRowType<infer Row>
        ? Row
        : InferRowFromQueryTokens<Rest>
   : unknown;

export type InferParamsFromQueryTokens<T> = T extends [infer Start, ...infer Rest]
   ? Start extends SqlParam<infer Param extends { Name: string; Type: unknown }>
      ? Record<Param["Name"], Param["Type"]> & InferParamsFromQueryTokens<Rest>
      : Start extends SqlQuery<infer Query extends { Params?: unknown; Row?: unknown }>
        ? Query["Params"] & InferParamsFromQueryTokens<Rest>
        : Start extends SqlCharm<infer Query extends { Params?: unknown; Row?: unknown }>
          ? Query["Params"] & InferParamsFromQueryTokens<Rest>
          : InferParamsFromQueryTokens<Rest>
   : unknown;

export type InferRowFromQuery<T> = T extends SqlQuery<infer U> ? U["Row"] : never;
export type InferParamsFromQuery<T> = T extends SqlQuery<infer U> ? U["Params"] : never;

export type ObjectOrUndefined<T> = keyof T extends never ? void : T;
