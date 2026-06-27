import { SqlParams, SqlQueryToken, SqlRow } from "#src/core/sql.js";
import { MockQueryHandler } from "#src/test/mock-query-handler.js";
import { SqlQuery } from "#src/core/query/sql-query.js";

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
