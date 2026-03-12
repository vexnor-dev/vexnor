import { Account } from "./codegen/main.account-table.js";

import { TestProject } from "vitest/node";
import { sql } from "valnor-sqlite3";

export default async function (proj: TestProject) {
   Object.assign(process.env, proj.config.env ?? proj.globalConfig.env);

   const { db } = await import("./config.js");
   const timestamp = new Date();
   const { changes } = await sql`
         delete
         from ${Account}
         where ${Account.$createdAt} < ${timestamp.toJSON()}
      `.run({ db });

   proj.vitest.logger.log(`global-setup: Deleted ${changes} rows from Account table older than ${timestamp}`);
}
