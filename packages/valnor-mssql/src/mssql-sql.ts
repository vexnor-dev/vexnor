import { SqlQueryRowOut, Sql, SqlColumn, SqlQueryParams, SqlQuery, SqlTableAny, SqlValue } from "valnor";
import { MssqlQueryHandler } from "./mssql-query-handler.js";

export function sql<
   TRow extends SqlQueryRowOut = Record<string, unknown>,
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
      | SqlQueryParams<TParams>,
>(strings: TemplateStringsArray, ...values: TValue[]): MssqlQueryHandler<{ Row: TRow; Params: TParams }> {
   return new MssqlQueryHandler(new SqlQuery(strings, values));
}
