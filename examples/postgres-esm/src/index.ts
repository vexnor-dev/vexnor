import * as console from "node:console";
import * as crypto from "node:crypto";
import { ok } from "node:assert";
import { Pool } from "pg";
import { Account, AccountStatusUdt, Order, OrderStatusUdt } from "./codegen/vexnor_dev.schema.js";
import { param, row, sql } from "vexnor";
import { jsonMany } from "vexnor-postgres";

const pool = new Pool({
   host: "localhost",
   user: "postgres",
   database: "postgres",
});

const id = crypto.randomUUID().slice(0, 4);
const newAccount = await sql`
   insert into ${Account}
      ${Account.insertColsVals({
         status: AccountStatusUdt.CREATED,
         firstName: `John_${id}`,
         lastName: `Doe_${id}`,
         email: `john.doe_${id}@example.com`,
      })}
      returning ${row(Account.$$)}
`.postgres.one({ db: pool });
console.log("new account:", newAccount);
ok(newAccount?.accountId, "accountId is required");

const findAccountById = sql`
   select ${Account.$$}
   from ${Account}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
`;
const account = await findAccountById.postgres.one({
   db: pool,
   params: {
      accountId: newAccount.accountId,
   },
});
console.log(`account (id=${newAccount.accountId}`, account);

const newOrders = await sql`
   INSERT INTO ${Order}
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
      RETURNING ${row(Order.$$)}
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

const UserOrders = sql`
   SELECT ${row(Order.$orderId, Order.$createdAt, Order.$status)}
   FROM ${Order}
   WHERE ${Order.$accountId} = ${Account.$accountId}
   ORDER BY ${Order.$createdAt} DESC
   LIMIT ${param<{ limit: number }>("limit")}`;

const findAccountsWithOrders = sql`
   SELECT ${row(Account.$$)},
          ${jsonMany(UserOrders).as("orders")}
   FROM ${Account} ${jsonMany(UserOrders)}
   WHERE ${Account.$accountId} = ${newAccount.accountId}`;

const accountWithLimitedOrders = await findAccountsWithOrders.postgres.one({
   db: pool,
   params: {
      limit: 1,
   },
});

console.log("account with orders:\n", accountWithLimitedOrders);
console.log("end");
await pool.end();
