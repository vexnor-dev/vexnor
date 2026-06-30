import * as console from "node:console";
import * as crypto from "node:crypto";
import { ok } from "node:assert";
import { Pool } from "pg";
import { Account, AccountStatusUdt, Order, OrderStatusUdt } from "./codegen/vexnor_dev.schema.js";
import { insert, param, row, set, sql } from "@vexnor/core";
import { jsonMany } from "@vexnor/postgres";

const pool = new Pool({
   host: "localhost",
   user: "postgres",
   database: "postgres",
});

const id = crypto.randomUUID().slice(0, 4);
const newAccount = await sql`
   insert into ${Account}
      ${insert(Account, "rows")}
      returning ${row(Account.$$)}
`.postgres.one({
   db: pool,
   params: {
      rows: [{
         status: AccountStatusUdt.CREATED,
         firstName: `John_${id}`,
         lastName: `Doe_${id}`,
         email: `john.doe_${id}@example.com`,
      }],
   },
});
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
      ${insert(Order, "rows")}
      RETURNING ${row(Order.$$)}
`.postgres.all({
   db: pool,
   params: {
      rows: [
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
      ],
   },
});
ok(newOrders?.length);

const accountUpdated = await sql`
   update ${Account}
   ${set(Account)}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
   returning ${row(Account.$$)}
`.postgres.one({
   db: pool,
   params: {
      set: { status: AccountStatusUdt.CONFIRMED },
      accountId: newAccount.accountId,
   },
});
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
   WHERE ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`;

const accountWithLimitedOrders = await findAccountsWithOrders.postgres.one({
   db: pool,
   params: {
      limit: 1,
      accountId: newAccount.accountId,
   },
});

console.log("account with orders:\n", accountWithLimitedOrders);
console.log("end");
await pool.end();
