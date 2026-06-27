import { VexnorPlugin, VexnorConnection, SqlColumnInfo, SqlColumnType, SqlSchema } from "#src/plugin/plugin.js";
import { SqlQuery } from "#src/core/query/sql-query.js";
import { MockQueryHandler } from "#src/test/mock-query-handler.js";
import { ok } from "node:assert";

export type MockResult<TRow> = { rows: TRow[] };
export type MockConnection = {
   query: <TRow, TResult extends MockResult<TRow> = MockResult<TRow>>(
      sql: string,
      params: unknown[],
   ) => Promise<TResult>;
};

export class MockPlugin extends VexnorPlugin<{
   Config: unknown;
   Connection: MockConnection;
}> {
   readonly name: string = "vexnor-test";
   driver = "test";
   dialect = "sql";

   constructor(
      { name }: { name: string },
      public readonly db?: MockConnection,
   ) {
      super();
      this.name = name;
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   getColumnType(_col: SqlColumnInfo): SqlColumnType {
      throw new Error("Not implemented");
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   getSchema(_args: { schemas: string[] }): Promise<SqlSchema> {
      throw new Error("Not implemented");
   }

   getLibrary() {
      return [];
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   async createConnection<TContext extends Record<string, unknown>>(_args: {
      config: unknown;
   }): Promise<VexnorConnection<{ Connection: MockConnection; Context: TContext }>> {
      ok(this.db, "No mock db defined");
      return new VexnorConnection(this.db, () => {}, null);
   }

   newQueryHandler<Args extends { Row?: unknown; Params?: unknown; Read: object; Write: object }>(
      query: SqlQuery<Pick<Args, "Row" | "Params">>,
   ) {
      return new MockQueryHandler<Pick<Args, "Row" | "Params">>(query);
   }
}
