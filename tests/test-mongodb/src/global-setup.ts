import { TestProject } from "vitest/node";
import { MongoClient } from "mongodb";
import { TestDataManager, assertTestData } from "./test-data-manager.js";
import { MONGODB_URI, MONGODB_DATABASE } from "./config.js";

let dataManager: TestDataManager;

export default async function (proj: TestProject) {
   Object.assign(process.env, proj.config.env ?? proj.globalConfig.env);

   const client = new MongoClient(MONGODB_URI);
   await client.connect();
   const db = client.db(MONGODB_DATABASE);

   dataManager = new TestDataManager(proj);
   await dataManager.setup(db);
   assertTestData(dataManager);

   // Store data manager reference for tests to access via globalThis
   (globalThis as Record<string, unknown>).__TEST_DATA_MANAGER__ = dataManager;

   proj.vitest.logger.log(
      `global-setup: Seeded MongoDB (${MONGODB_DATABASE}): ` +
      `${dataManager.allAccounts.length} accounts, ${dataManager.products.length} products, ${dataManager.orders.length} orders`,
   );

   await client.close();
}
