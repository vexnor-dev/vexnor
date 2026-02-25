import { Account } from "./codegen/valnor_test.account-table.js";
import { TestProject } from "vitest/node";
import { sql } from "valnor-postgres";
import { pool } from "./postgres-pool.js";

export default async function (proj: TestProject) {
   const timestamp = new Date();
   const { rowCount } = await sql`
         delete
         from ${Account}
         where ${Account.$createdAt} < ${timestamp}
      `.postgres.run({ db: pool });

   proj.vitest.logger.log(`global-setup: Deleted ${rowCount} rows from Account table older than ${timestamp}`);
}
