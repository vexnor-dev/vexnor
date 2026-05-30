import { beforeAll, describe, expect, test } from "vitest";
import { info, param, row, SqlBuildContext } from "vexnor";
import { Account, Order } from "./codegen/main.schema.js";
import { jsonMany, Sqlite3Tokenizer, sql } from "vexnor-sqlite3";
import { db } from "./config.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("jsonMany() tests", async (ctx) => {
   const dataManager = new TestDataManager(ctx, {
      ACCOUNT_ROOT_COUNT: 1,
      ACCOUNT_CHILD_FACTOR: 2,
      ACCOUNT_ORDER_FACTOR: 2,
   });

   beforeAll(async () => {
      await dataManager.initRootAccounts(db);
      await dataManager.initChildAccounts(db);
      await dataManager.initOrders(db);
   });

   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
      from ${Order}
      where ${Order.$accountId} = ${Account.out.$accountId}
      order by ${Order.$createdAt} desc
      limit ${param<{ limit: number }>("limit")}`;

   test("jsonMany(): select build - returns correct column in result", async () => {
      const parentAccount = dataManager.rootAccounts[0]!;
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account}
         where ${Account.$accountId} = ${parentAccount.accountId}
      `;
      const results = await query.sqlite.all({ db, params: { limit: 10 } });
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("orders");
   });

   test("jsonMany(): from - throws when used in FROM context", () => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer() });
      context.next("from");
      expect(() => jsonMany(AccountOrders).build(context, {})).toThrow(
         "Cannot use json aggregation with SQL keyword 'from'",
      );
   });

   test("jsonMany().as() with params - limit is respected", async () => {
      const parentAccount = dataManager.rootAccounts[0]!;
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account}
         where ${Account.$accountId} = ${parentAccount.accountId}
      `;
      const results = await query.sqlite.all({ db, params: { limit: 1 } });
      expect(results).toHaveLength(1);
      const parsed = results[0]!.orders;
      expect(parsed).toHaveLength(1);
   });
});
