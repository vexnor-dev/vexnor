import { RowOut, Sql, SqlColumn, SqlParams, SqlQuery, SqlTableAny, SqlValue } from "valnor";
import { BetterSqlite3QueryHandler } from "./better-sqlite3-query-handler.js";

export function sql<
   TRow extends RowOut = Record<string, unknown>,
   TParams extends Record<string, SqlValue> | undefined = undefined,
   TSql extends Sql = Sql | SqlTableAny | SqlColumn,
   TValue =
      | SqlValue
      | TSql
      | TSql[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | SqlQuery<{ Row: any; Params: Partial<TParams>; QueryResult: object }>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | SqlQuery<{ Row: any; Params: Partial<TParams>; QueryResult: object }>[]
      | SqlParams<TParams>,
>(strings: TemplateStringsArray, ...values: TValue[]): BetterSqlite3QueryHandler<{ Row: TRow; Params: TParams }> {
   return new BetterSqlite3QueryHandler(new SqlQuery(strings, values));
}
