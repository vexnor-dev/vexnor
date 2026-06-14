import { SqlParams, SqlQueryToken, SqlRow } from "#/core/sql.js";
import { MockQueryHandler } from "#/test/mock-query-handler.js";
import { SqlQuery } from "#/core/query/sql-query.js";

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   strings: TemplateStringsArray,
   ...values: Tokens
): MockQueryHandler<{
   Row: SqlRow<typeof values>;
   Params: SqlParams<typeof values>;
}> {
   const query = new SqlQuery<{
      Row: SqlRow<typeof values>;
      Params: SqlParams<typeof values>;
   }>({ rawStrings: strings, rawValues: values });
   return new MockQueryHandler(query);
}
