import { Account } from "./codegen/main.account-table.js";
import { Order } from "./codegen/main.order-table.js";
import { OrderItem } from "./codegen/main.order_item-table.js";

import { TestProject } from "vitest/node";
import { sql } from "valnor-sqlite3";

export default async function (proj: TestProject) {
   Object.assign(process.env, proj.config.env ?? proj.globalConfig.env);

   const { db } = await import("./config.js");
   const timestamp = new Date();

   await sql`delete from ${OrderItem} where ${OrderItem.$createdAt} < ${timestamp.toJSON()}`.run({ db });
   await sql`delete from ${Order} where ${Order.$createdAt} < ${timestamp.toJSON()}`.run({ db });
   const { changes } = await sql`delete from ${Account} where ${Account.$createdAt} < ${timestamp.toJSON()}`.run({ db });

   proj.vitest.logger.log(`global-setup: Deleted ${changes} rows from Account table older than ${timestamp}`);
}
