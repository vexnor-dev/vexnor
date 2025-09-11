import { Then, When } from "@cucumber/cucumber";
import { TestWorld } from "../test-world.js";
import { Account, Order, pool, sql } from "../db.js";
import { AccountStatusUdt } from "../codegen/one_sql-enums.js";
import crypto from "node:crypto";
import { IAccountSelect } from "../codegen/one_sql.account-table.js";
import { deepStrictEqual, notDeepStrictEqual, ok } from "node:assert";
import { AccountWithOrders } from "../types/index.js";

When(/^Inserting a new Account$/, async function (this: TestWorld) {
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
   `.getOneRequired(pool);

   ok(newAccount?.accountId, "new accountId is required");
   this.accountInserted = newAccount;
});

Then(/^Fetch newly inserted Account$/, async function (this: TestWorld) {
   ok(this.accountInserted?.accountId, "accountId is required");

   const account = await sql<IAccountSelect>`
      select ${Account.$$all}
      from ${Account}
      where ${Account.accountId} = ${this.accountInserted.accountId}
   `.getOneRequired(pool);

   deepStrictEqual(account, this.accountInserted);
});

When(
   /^Fetch top (\d+) accounts including their orders aggregated as json array$/,
   async function (this: TestWorld, countOfAccounts: number) {
      const Orders = sql<AccountWithOrders["orders"][number]>`
         select ${Order.orderId}, ${Order.createdAt}, ${Order.status}, ${Order.accountId}
         from ${Order}
         where ${Order.accountId} = ${Account.accountId}
         order by ${Order.createdAt} desc
         limit ${countOfAccounts}
      `;

      const findAccounts = sql<AccountWithOrders>`
         select ${Account.$$all},
                coalesce(
                      jsonb_agg(${Orders.ROW.$$all}) filter (where ${Orders.ROW.$$all} is not null),
                      '[]'
                ) as orders
         from ${Account}
                 left join lateral (${Orders}) ON true
         group by ${Account.accountId}
         order by ${Account.createdAt} desc
      `;
      this.log(findAccounts.text());

      const accountsWithOrders = await findAccounts.getAll(pool);

      ok(accountsWithOrders?.length, "accounts are required");
      this.accountsWithOrders = accountsWithOrders;
   },
);

When(/^Accounts should have respective orders$/, function (this: TestWorld) {
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
