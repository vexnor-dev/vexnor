import { Account } from "./codegen/valnor_test.account-table.js";
import { TestProject } from "vitest/node";
import { sql } from "valnor-postgres";

export default async function (proj: TestProject) {
   process.env["VALNOR_ENV_PATH"] = proj.config.env?.["VALNOR_ENV_PATH"] ?? proj.globalConfig.env?.["VALNOR_ENV_PATH"];

   const timestamp = new Date();
   const { pool } = await import("./postgres-pool.js");
   let client = undefined;
   try {
      client = await pool.connect();
      const { rowCount } = await sql`
         delete
         from ${Account}
         where ${Account.$createdAt} < ${timestamp}
      `.postgres.run({ db: client });

      proj.vitest.logger.log(`global-setup: Deleted ${rowCount} rows from Account table older than ${timestamp}`);
   } finally {
      client?.release(true);
      await pool.end();
   }
}
