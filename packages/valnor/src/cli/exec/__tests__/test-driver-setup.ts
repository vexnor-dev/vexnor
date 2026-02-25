import { SqlQuery, SqlQueryHandler, SqlRunArgs, SqlQueryToken } from "../../../core/index.js";
import { InferParamsFromSqlTokens, InferRowFromSqlTokens } from "../../../core/sql.js";

let mockData: unknown[] = [{ id: 1, result: "test" }];

export class TestDriverQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<{
   Row: T["Row"];
   Params: T["Params"];
   QueryResult: { rows: T["Row"][] };
   QueryClient: unknown;
}> {
   constructor(query: SqlQuery<{ Params: T["Params"]; Row: T["Row"] }>) {
      super(query);
   }

   resolveRows(result: { rows: T["Row"][] }): T["Row"][] {
      return result.rows;
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   async run(args: SqlRunArgs<unknown, T["Params"]>): Promise<{ rows: T["Row"][] }> {
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
   Row: InferRowFromSqlTokens<typeof values>;
   Params: InferParamsFromSqlTokens<typeof values>;
}> {
   const query = new SqlQuery<{
      Row: InferRowFromSqlTokens<typeof values>;
      Params: InferParamsFromSqlTokens<typeof values>;
   }>({ rawStrings: strings, rawValues: values });
   return new TestDriverQueryHandler(query);
}
