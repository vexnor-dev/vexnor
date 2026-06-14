import { TestProject } from "vitest/node";
import { TestDataManager } from "./test-data-manager.js";

export default async function (proj: TestProject) {
   Object.assign(process.env, proj.config.env ?? proj.globalConfig.env);
   const dataManager = new TestDataManager(proj);
   const { pool } = await import("./postgres-pool.js");
   const rowsAffected = await dataManager.cleanAll(pool);
   proj.vitest.logger.log(`global-setup: Cleaned-up records`, rowsAffected);
}
