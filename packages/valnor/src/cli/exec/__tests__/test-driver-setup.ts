import { SqlQuery, AsyncQueryHandler, SqlRunArgs, SqlQueryToken } from "../../../core/index.js";
import { InferParamsFromQueryTokens, InferResultRowFromQueryTokens } from "../../../core/sql.js";

let mockData: unknown[] = [{ id: 1, result: "test" }];

export class TestDriverQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends AsyncQueryHandler<{
   Row: T["Row"];
   Params: T["Params"];
   QueryResult: { rows: T["Row"][] };
   QueryClient: unknown;
}> {
   constructor(query: SqlQuery<T>) {
      super(query);
   }

   resolveRows(result: { rows: T["Row"][] }): T["Row"][] {
      return result.rows;
   }

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
   Row: InferResultRowFromQueryTokens<typeof values>;
   Params: InferParamsFromQueryTokens<typeof values>;
}> {
   const query = new SqlQuery<{
      Row: InferResultRowFromQueryTokens<typeof values>;
      Params: InferParamsFromQueryTokens<typeof values>;
   }>({ rawStrings: strings, rawValues: values });
   return new TestDriverQueryHandler(query);
}
