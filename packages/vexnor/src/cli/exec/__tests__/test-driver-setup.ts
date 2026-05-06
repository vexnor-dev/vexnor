import { SqlQuery } from "#/core/query/sql-query.js";
import { SqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { SqlRunArgs } from "#/core/query/sql-query-types.js";
import { SqlQueryToken, SqlParams, SqlRow } from "#/core/sql.js";

let mockData: unknown[] = [{ id: 1, result: "test" }];

export class TestDriverQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Params" | "Row"> & {
      QueryResult: { rows: T["Row"][] };
      Connection: unknown;
   }
> {
   constructor(query: SqlQuery<{ Params: T["Params"]; Row: T["Row"] }>) {
      super(query);
   }

   resolveRows(result: { rows: T["Row"][] }): T["Row"][] {
      return result.rows;
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   async run(_args: SqlRunArgs<{ Connection: unknown; Params: T["Params"] }>): Promise<{ rows: T["Row"][] }> {
      return { rows: mockData as T["Row"][] };
   }
}

export function setTestMockData(data: unknown[]): void {
   mockData = data;
}

export function sql<Token extends SqlQueryToken = SqlQueryToken, Tokens extends Token[] = Token[]>(
   strings: TemplateStringsArray,
   ...values: Tokens
): TestDriverQueryHandler<{
   Row: SqlRow<typeof values>;
   Params: SqlParams<typeof values>;
}> {
   const query = new SqlQuery<{
      Row: SqlRow<typeof values>;
      Params: SqlParams<typeof values>;
   }>({ rawStrings: strings, rawValues: values });
   return new TestDriverQueryHandler(query);
}
