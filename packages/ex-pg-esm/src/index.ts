import * as console from "node:console";
import * as crypto from "node:crypto";
import { ok } from "node:assert";
import { Pool } from "pg";
import {
   Account,
   AccountStatusUdt,
   IAccountSelect,
   IOrderJson,
   IOrderSelect,
   Order,
   OrderStatusUdt,
} from "./codegen/one_sql.schema.js";
import { param, sql } from "valnor/core";
import valnorPostgres, { jsonAgg } from "valnor-postgres";

valnorPostgres.register();

const pool = new Pool({
   host: "localhost",
   user: "postgres",
   database: "postgres",
});

const id = crypto.randomUUID().slice(0, 4);
const newAccount = await sql<IAccountSelect>`
   insert into ${Account}
      ${Account.$$values({
         status: AccountStatusUdt.CREATED,
         firstName: `John_${id}`,
         lastName: `Doe_${id}`,
         email: `john.doe_${id}@example.com`,
      })}
      returning ${Account.$$all}
`.pg.getOneRequired({ db: pool });
console.log("new account:", newAccount);
ok(newAccount?.accountId, "accountId is required");

const findAccountById = sql<IAccountSelect, { accountId: string }>`
   select ${Account.$$all}
   from ${Account}
   where ${Account.accountId} = ${param("accountId")}
`;
const account = await findAccountById.pg.getOneRequired(pool, {
   accountId: newAccount.accountId,
});
console.log(`account (id=${newAccount.accountId}`, account);

const newOrders = await sql<IOrderSelect>`
   INSERT INTO ${Order}
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
      RETURNING ${Order.$$all}
`.pg.getAll(pool);
ok(newOrders?.length);

const accountUpdated = await sql<IAccountSelect>`
   update ${Account}
   set ${Account.$$set({
      status: AccountStatusUdt.CONFIRMED,
   })}
   where ${Account.accountId} = ${newAccount.accountId}
   returning ${Account.$$all}
`.pg.getOneRequired(pool);
console.log("account updated:", accountUpdated);

type IAccountWithOrders = IAccountSelect & {
   orders: Pick<IOrderJson, "orderId" | "createdAt" | "status">[];
};

const UserOrders = sql<IOrderSelect, { limit: number }>`
   SELECT ${Order.orderId}, ${Order.createdAt}, ${Order.status}
   FROM ${Order}
   WHERE ${Order.accountId} = ${Account.accountId}
   ORDER BY ${Order.createdAt} DESC
   LIMIT ${param("limit")}`;

const findAccountsWithOrders = sql<IAccountWithOrders, { limit: number }>`
   SELECT ${Account.$$all},
          ${jsonAgg(UserOrders)} "orders"
   FROM ${Account} ${jsonAgg(UserOrders)}
   WHERE ${Account.accountId} = ${newAccount.accountId}`;

const accountWithLimitedOrders = await findAccountsWithOrders.pg.getOneRequired(pool, {
   limit: 1,
});

console.log("account with orders:\n", accountWithLimitedOrders);
console.log("end");
await pool.end();
