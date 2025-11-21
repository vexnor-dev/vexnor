import { SqlQueryRowOut, Sql, SqlTableColumn, SqlQueryParams, SqlQuery, SqlTableAny, SqlSelectValue } from "valnor";
import { BetterSqlite3QueryHandler } from "./better-sqlite3-query-handler.js";

export function sql<
   TRow extends SqlQueryRowOut = Record<string, unknown>,
   TParams extends Record<string, SqlSelectValue> | undefined = undefined,
   TSql extends Sql = Sql | SqlTableAny | SqlTableColumn,
   TValue =
      | SqlSelectValue
      | TSql
      | TSql[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | SqlQuery<{ Row: any; Params: Partial<TParams>; QueryResult: object }>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | SqlQuery<{ Row: any; Params: Partial<TParams>; QueryResult: object }>[]
      | SqlQueryParams<TParams>,
>(strings: TemplateStringsArray, ...values: TValue[]): BetterSqlite3QueryHandler<{ Row: TRow; Params: TParams }> {
   return new BetterSqlite3QueryHandler(new SqlQuery(strings, values));
}
