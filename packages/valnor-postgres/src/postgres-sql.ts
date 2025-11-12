import { InferParamsFromQueryTokens, InferResultRowFromQueryTokens, SqlQuery, SqlQueryToken } from "valnor";
import { PostgresQueryHandler } from "./postgres-query-handler.js";

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   strings: TemplateStringsArray,
   ...values: Tokens[]
) {
   const query = new SqlQuery<{
      Row: InferResultRowFromQueryTokens<typeof values>;
      Params: InferParamsFromQueryTokens<typeof values>;
   }>(strings, values);
   return new PostgresQueryHandler(query);
}
