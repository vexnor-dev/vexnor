import { ValnorPlugin, ValnorConnection } from "../../../plugin/index.js";

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
}

export default new TestPlugin();
