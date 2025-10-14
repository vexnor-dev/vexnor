import { Then, When } from "@cucumber/cucumber";
import { TestWorld } from "../../test-world.js";
import crypto from "node:crypto";
import { deepStrictEqual, notDeepStrictEqual, ok } from "node:assert";
import { sql } from "valnor";
import { Account, IAccountSelect } from "../../codegen/mssql/one_sql.account-table.js";
import { Order } from "../../codegen/mssql/one_sql.order-table.js";
import { jsonAgg } from "valnor-mssql";
import { getRequest } from "../../db/mssql.js";
import { AccountWithOrders } from "../../types/index.js";

When(/^Inserting a new Account using MSSQL$/, async function (this: TestWorld) {
  // Generate our own GUID so we can reliably re-select the row after insert
  const guid = crypto.randomUUID();
  const id = guid.slice(0, 4);

  await sql<object>`
      insert into ${Account}
         ${Account.$$values({
           accountId: guid,
           status: "created",
           firstName: `John-${id}`,
           lastName: `Doe-${id}`,
           email: `john.doe-${id}}@example.com`,
         })}
    `.mssql.getAll({ db: await getRequest() });

  const account = await sql<IAccountSelect>`
      select ${Account.$$all}
      from ${Account}
      where ${Account.accountId} = ${guid}
    `.mssql.getOneRequired({ db: await getRequest() });

  ok(account?.accountId, "new accountId is required");
  this.mssql.accountInserted = account;
});

Then(/^Fetch newly inserted Account using MSSQL$/, async function (this: TestWorld) {
  ok(this.mssql.accountInserted?.accountId, "accountId is required");

  const account = await sql<IAccountSelect>`
      select ${Account.$$all}
      from ${Account}
      where ${Account.accountId} = ${this.mssql.accountInserted.accountId}
    `.mssql.getOneRequired({ db: await getRequest() });

  deepStrictEqual(account, this.mssql.accountInserted);
});

When(
  /^Fetch top (\d+) accounts including their orders aggregated as json array using MSSQL$/,
  async function (this: TestWorld, countOfAccounts: number) {
    const Orders = sql<AccountWithOrders["orders"][number]>`
      select ${Order.orderId}, ${Order.createdAt}, ${Order.status}, ${Order.accountId}
      from ${Order}
      where ${Order.accountId} = ${Account.accountId}
      order by ${Order.createdAt} desc
    `;

    const agg = jsonAgg(Orders);
    const findAccounts = sql<AccountWithOrders>`
      select ${Account.$$all},
             ${agg.select} as orders
      from ${Account} ${agg.body}
      order by ${Account.createdAt} desc
      offset 0 rows fetch next ${countOfAccounts} rows only
    `;

    const accountsWithOrders = await findAccounts.mssql.getAll({ db: await getRequest() });

    ok(accountsWithOrders?.length, "accounts are required");
    this.mssql.accountsWithOrders = accountsWithOrders;
  },
);

When(/^Accounts should have respective orders using MSSQL$/, function (this: TestWorld) {
  ok(this.mssql.accountsWithOrders?.length, "accounts with orders are required");
  for (const account of this.mssql.accountsWithOrders) {
    notDeepStrictEqual(account.orders.length, 0, `Account ${account.accountId}: orders are required`);

    for (const order of account.orders) {
      deepStrictEqual(order.accountId, account.accountId, `Order ${order.orderId}: account id not matching ${account.accountId}`);
      ok(order.createdAt, `Order ${order.orderId}: createdAt is required`);
      deepStrictEqual(typeof order.createdAt, "string", `Order ${order.orderId}: createdAt is not a string`);
    }
  }
});
