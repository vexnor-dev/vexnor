import { Then, When } from "@cucumber/cucumber";
import { TestWorld } from "../../test-world.js";
import { pool } from "../../db/postgres.js";
import { AccountStatusUdt } from "../../codegen/pg/one_sql-enums.js";
import crypto from "node:crypto";
import { Account, IAccountSelect } from "../../codegen/pg/one_sql.account-table.js";
import { deepStrictEqual, notDeepStrictEqual, ok } from "node:assert";
import { AccountWithOrders } from "../../types/index.js";
import { sql } from "valnor";
import { Order } from "../../codegen/pg/one_sql.order-table.js";
import { jsonAgg } from "valnor-postgres";

When(/^Inserting a new Account using PostgreSQL$/, async function (this: TestWorld) {
   const id = crypto.randomUUID().slice(0, 4);
   const newAccount = await sql<IAccountSelect>`
      insert into ${Account}
         ${Account.$$values({
            status: AccountStatusUdt.CREATED,
            firstName: `John-${id}`,
            lastName: `Doe-${id}`,
            email: `john.doe-${id}}@example.com`,
         })}
         returning ${Account.$$all}
   `.pg.getOneRequired({ db: pool });

   ok(newAccount?.accountId, "new accountId is required");
   this.accountInserted = newAccount;
});

Then(/^Fetch newly inserted Account using PostgreSQL$/, async function (this: TestWorld) {
   ok(this.accountInserted?.accountId, "accountId is required");

   const account = await sql<IAccountSelect>`
      select ${Account.$$all}
      from ${Account}
      where ${Account.accountId} = ${this.accountInserted.accountId}
   `.pg.getOneRequired({ db: pool });

   deepStrictEqual(account, this.accountInserted);
});

When(
   /^Fetch top (\d+) accounts including their orders aggregated as json array using PostgreSQL$/,
   async function (this: TestWorld, countOfAccounts: number) {
      const Orders = sql<AccountWithOrders["orders"][number]>`
         select ${Order.orderId}, ${Order.createdAt}, ${Order.status}, ${Order.accountId}
         from ${Order}
         where ${Order.accountId} = ${Account.accountId}
         order by ${Order.createdAt} desc
      `;

      const findAccounts = sql<AccountWithOrders>`
         select ${Account.$$all},
                ${jsonAgg(Orders)} as orders
         from ${Account} ${jsonAgg(Orders)}
         order by ${Account.createdAt} desc
         limit ${countOfAccounts}
      `;

      const accountsWithOrders = await findAccounts.pg.getAll({ db: pool });

      ok(accountsWithOrders?.length, "accounts are required");
      this.accountsWithOrders = accountsWithOrders;
   },
);

When(/^Accounts should have respective orders using PostgreSQL$/, function (this: TestWorld) {
   ok(this.accountsWithOrders?.length, "accounts with orders are required");
   for (const account of this.accountsWithOrders) {
      notDeepStrictEqual(account.orders.length, 0, `Account ${account.accountId}: orders are required`);

      for (const order of account.orders) {
         deepStrictEqual(
            order.accountId,
            account.accountId,
            `Order ${order.orderId}: account id not matching ${account.accountId}`,
         );
         ok(order.createdAt, `Order ${order.orderId}: createdAt is required`);
         deepStrictEqual(typeof order.createdAt, "string", `Order ${order.orderId}: createdAt is not a string`);
      }
   }
});
