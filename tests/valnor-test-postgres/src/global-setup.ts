import { Account } from "./codegen/valnor_test.account-table.js";
import { TestProject } from "vitest/node";
import { sql } from "valnor-postgres";

export default async function (proj: TestProject) {
   process.env["ENV_PATH"] = proj.config.env["ENV_PATH"];

   const timestamp = new Date();
   const { pool } = await import("./postgres-pool.js");
   const { rowCount } = await sql`
         delete
         from ${Account}
         where ${Account.$createdAt} < ${timestamp}
      `.postgres.run({ db: pool });

   proj.vitest.logger.log(`global-setup: Deleted ${rowCount} rows from Account table older than ${timestamp}`);
}
