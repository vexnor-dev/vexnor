import { Account } from "./codegen/valnor_test.account-table.js";
import { TestProject } from "vitest/node";
import { sql } from "valnor-postgres";

export default async function (proj: TestProject) {
   Object.assign(process.env, proj.config.env ?? proj.globalConfig.env);

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
