import { ValnorPlugin, ValnorConnection } from "../../../plugin/index.js";
import { SqlQueryHandler, SqlQuery } from "../../../core/index.js";
import { TestDriverQueryHandler } from "./test-driver-setup.js";

export class TestPlugin extends ValnorPlugin<{ Config: unknown; Connection: unknown }> {
   driver = "test";

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
