import { pool } from "./mssql-pool.js";
import { sql } from "valnor-mssql";
import { Account } from "./codegen/valnor_test.account-table.js";
import { TestProject } from "vitest/node";

export default async function (proj: TestProject) {
   try {
      await pool.connect();
      const timestamp = new Date();
      const {
         rowsAffected: [rowsAffected],
      } = await sql`
         delete
         from ${Account}
         where ${Account.$createdAt} < ${timestamp}
      `.mssql.run({ db: pool.request() });

      proj.vitest.logger.log(`global-setup: Deleted ${rowsAffected} rows from Account table older than ${timestamp}`);
   } finally {
      await pool.close();
   }
}
