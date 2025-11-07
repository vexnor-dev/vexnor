import * as console from "node:console";
import * as crypto from "node:crypto";
import { ok } from "node:assert";
import { AccountStatusUdt, OrderStatusUdt } from "./codegen/one_sql-enums.js";
import { Account, IAccountSelect, IOrderSelect, Order } from "./codegen/one_sql.schema.js";
import { JsonRow, sql } from "valnor";
import ValnorPostgres from "valnor-postgres";
import { Pool } from "pg";

ValnorPostgres.register();

const pool = new Pool({
   host: "localhost",
   user: "postgres",
   database: "postgres",
});

async function main() {
   const id = crypto.randomUUID().slice(0, 4);

   const newAccount = await sql<IAccountSelect>`
      insert into ${Account}
         ${Account.$$values({
            firstName: `John_${id}`,
            lastName: `Doe_${id}`,
            email: `test_${id}@example.com`,
            status: AccountStatusUdt.CREATED,
         })}
         returning ${Account.$$all}
   `.pg.getOneRequired({ db: pool });
   console.log("new account:", newAccount);
   ok(newAccount?.accountId, "accountId is required");

   const newOrders = await sql<IAccountSelect>`
      insert into ${Order}
         ${Order.$$values(
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
         returning ${Order.$$all}
   `.pg.getAll({ db: pool });
   ok(newOrders?.length);

   const accountUpdated = await sql<IAccountSelect>`
      update ${Account}
      set ${Account.$$set({
         status: AccountStatusUdt.CONFIRMED,
      })}
      where ${Account.$accountId} = ${newAccount.accountId}
      returning ${Account.$$all}
   `.pg.getOneRequired({ db: pool });
   console.log("account updated:", accountUpdated);

   interface AccountWithOrders extends IAccountSelect {
      orders: JsonRow<Pick<IOrderSelect, "orderId" | "status" | "createdAt" | "modifiedAt">>[];
   }

   const accountWithLimitedOrders = await sql<AccountWithOrders[]>`
      SELECT ${Account.$$all},
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
      GROUP BY ${Account.$accountId}`.pg.getAll({ db: pool });

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
