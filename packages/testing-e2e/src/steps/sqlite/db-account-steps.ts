import { Then, When } from "@cucumber/cucumber";
import { TestWorld } from "../../test-world.js";
import { db } from "../../db/sqlite.js";
import crypto from "node:crypto";
import { Account, IAccountSelect } from "../../codegen/sqlite/main.account-table.js";
import { deepStrictEqual, notDeepStrictEqual, ok } from "node:assert";
import { AccountWithOrders } from "../../types/index.js";
import { sql } from "valnor";
import { Order } from "../../codegen/sqlite/main.order-table.js";
import { jsonGroupArray } from "valnor-sqlite3";

When(/^Inserting a new Account using SQLite$/, async function (this: TestWorld) {
   const id = crypto.randomUUID().slice(0, 4);
   const newAccounts = sql<IAccountSelect>`
      insert into ${Account}
         ${Account.$$values({
            status: "created",
            firstName: `John-${id}`,
            lastName: `Doe-${id}`,
            email: `john.doe-${id}}@example.com`,
         })}
         returning ${Account.$$all}
   `.sqlite3.getAll({ db: db });

   const newAccount = newAccounts[0];
   if (!newAccount) throw new Error("Failed to insert account");

   ok(newAccount?.accountId, "new accountId is required");
   this.sqlite.accountInserted = newAccount;
});

Then(/^Fetch newly inserted Account using SQLite$/, async function (this: TestWorld) {
   ok(this.sqlite.accountInserted?.accountId, "accountId is required");

   const accounts = sql<IAccountSelect>`
      select ${Account.$$all}
      from ${Account}
      where ${Account.accountId} = ${this.sqlite.accountInserted.accountId}
   `.sqlite3.getAll({ db: db });

   const account = accounts[0];
   if (!account) throw new Error("Account not found");

   deepStrictEqual(account, this.sqlite.accountInserted);
});

When(
   /^Fetch top (\d+) accounts including their orders aggregated as json array using SQLite$/,
   async function (this: TestWorld, countOfAccounts: number) {
      const Orders = sql<AccountWithOrders["orders"][number]>`
         select ${Order.orderId}, ${Order.createdAt}, ${Order.status}, ${Order.accountId}
         from ${Order}
         where ${Order.accountId} = ${Account.accountId}
         order by ${Order.createdAt} desc
      `;

      const findAccounts = sql<AccountWithOrders>`
         select ${Account.$$all},
                ${jsonGroupArray(Orders)} as orders
         from ${Account} ${jsonGroupArray(Orders)}
         order by ${Account.createdAt} desc
         limit ${countOfAccounts}
      `;

      const accountsWithOrders = findAccounts.sqlite3.getAll({ db });

      ok(accountsWithOrders?.length, "accounts are required");
      this.sqlite.accountsWithOrders = accountsWithOrders;
   },
);

When(/^Accounts should have respective orders using SQLite$/, function (this: TestWorld) {
   ok(this.sqlite.accountsWithOrders?.length, "accounts with orders are required");
   for (const account of this.sqlite.accountsWithOrders) {
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
