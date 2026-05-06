import { TestProject } from "vitest/node";
import { ConnectionPool } from "mssql";
import { TestDataManager } from "./test-data-manager.js";

export default async function (proj: TestProject) {
   Object.assign(process.env, proj.config.env ?? proj.globalConfig.env);
   console.log(`global-setup.ts '${proj.name}'`, process.env["VALNOR_ENV_PATH"]);
   const dataManager = new TestDataManager(proj);

   let pool: ConnectionPool | undefined = undefined;
   try {
      ({ pool } = await import("./mssql-pool.js"));
      await pool.connect();

      const rowsAffected = await dataManager.cleanAll(pool);
      proj.vitest.logger.log(`global-setup: Cleaned-up records`, rowsAffected);
   } finally {
      await pool?.close();
   }
}
