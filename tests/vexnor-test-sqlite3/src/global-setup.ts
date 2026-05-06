import { TestProject } from "vitest/node";
import { TestDataManager } from "./test-data-manager.js";

export default async function (proj: TestProject) {
   Object.assign(process.env, proj.config.env ?? proj.globalConfig.env);

   const dataManager = new TestDataManager(proj);
   const { db } = await import("./config.js");

   const { timestamp } = await dataManager.cleanAll(db);
   proj.vitest.logger.log(`global-setup: Cleaned up records older than ${timestamp}`);
}
