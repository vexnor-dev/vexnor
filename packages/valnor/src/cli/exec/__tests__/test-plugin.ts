import { ValnorPlugin, ValnorConnection } from "../../../plugin/index.js";
import { AsyncQueryHandler, SqlQuery } from "../../../core/index.js";
import { TestDriverQueryHandler } from "./test-driver-setup.js";

export class TestPlugin extends ValnorPlugin {
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

   newQueryHandler<T extends { Row?: unknown; Params?: unknown; QueryResult: object; QueryClient: unknown }>(
      query: SqlQuery<T>,
   ): AsyncQueryHandler<T> {
      return new TestDriverQueryHandler(query);
   }
}

export default new TestPlugin();
