import * as console from "node:console";
import * as crypto from "node:crypto";
import { ok } from "node:assert";
import { Account, AccountStatusUdt, Order, OrderStatusUdt } from "./codegen/vexnor_dev.schema.js";
import { row, sql } from "@vexnor/core";
import { Pool } from "pg";
import "@vexnor/postgres";

const pool = new Pool({
   host: "localhost",
   user: "postgres",
   database: "postgres",
});

async function main() {
   const id = crypto.randomUUID().slice(0, 4);

   const newAccount = await sql`
      insert into ${Account}
         ${Account.insertColsVals({
            firstName: `John_${id}`,
            lastName: `Doe_${id}`,
            email: `test_${id}@example.com`,
            status: AccountStatusUdt.CREATED,
         })}
         returning ${row(Account.$$)}
   `.postgres.one({ db: pool });
   console.log("new account:", newAccount);
   ok(newAccount?.accountId, "accountId is required");

   const newOrders = await sql`
      insert into ${Order}
         ${Order.insertColsVals(
            {
               accountId: newAccount.accountId,
               status: OrderStatusUdt.CREATED,
               createdAt: new Date(),
               modifiedAt: new Date(),
            },
            {
               accountId: newAccount.accountId,
               status: OrderStatusUdt.DELIVERED,
               createdAt: new Date(),
               modifiedAt: new Date(),
            },
         )}
         returning ${row(Order.$$)}
   `.postgres.all({ db: pool });
   ok(newOrders?.length);

   const accountUpdated = await sql`
      update ${Account}
      set ${Account.updateSet({
         status: AccountStatusUdt.CONFIRMED,
      })}
      where ${Account.$accountId} = ${newAccount.accountId}
      returning ${row(Account.$$)}
   `.postgres.one({ db: pool });
   console.log("account updated:", accountUpdated);

   const accountWithLimitedOrders = await sql`
      SELECT ${Account.$$},
             COALESCE(
                   jsonb_agg(orders.*) FILTER (WHERE orders IS NOT NULL),
                   '[]'
             ) as orders
      FROM ${Account}
              LEFT JOIN LATERAL (
         SELECT ${Order.$orderId}, ${Order.$createdAt}, ${Order.$status}
         FROM ${Order}
         WHERE ${Order.$accountId} = ${Account.$accountId}
         ORDER BY ${Order.$createdAt} DESC
         LIMIT 5 -- Get only the 5 most recent orders
         ) orders ON true
      WHERE ${Account.$accountId} = ${newAccount.accountId}
      GROUP BY ${Account.$accountId}`.postgres.all({ db: pool });

   console.log("account with orders:\n", accountWithLimitedOrders);
}

main()
   .catch((err) => {
      console.error(err);
      process.exit(1);
   })
   .finally(async () => {
      await pool.end();
   });
