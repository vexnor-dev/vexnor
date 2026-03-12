import { ValnorPlugin, ValnorConnection } from "#/plugin/plugin.js";
import { SqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { TestDriverQueryHandler } from "#/cli/exec/__tests__/test-driver-setup.js";

export class TestPlugin extends ValnorPlugin<{ Config: unknown; Connection: unknown }> {
   driver = "test";
   dialect = "sql";

   getColumnType(): never {
      throw new Error("Not implemented");
   }

   getSchema(): never {
      throw new Error("Not implemented");
   }

   getLibrary() {
      return [];
   }

   async createConnection(): Promise<ValnorConnection<unknown>> {
      const mockDb = {};
      return new ValnorConnection<unknown>(mockDb, async () => {});
   }

   newQueryHandler<T extends { Row?: unknown; Params?: unknown; QueryResult: object; Connection: unknown }>(
      query: SqlQuery<{ Params: T["Params"]; Row: T["Row"] }>,
   ): SqlQueryHandler<T> {
      return new TestDriverQueryHandler<T>(query);
   }
}

export default new TestPlugin();
