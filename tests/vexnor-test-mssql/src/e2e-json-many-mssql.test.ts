import { beforeAll, describe, expect, test } from "vitest";
import { info, param, row } from "vexnor";
import { Account, IAccountSelect, IOrderSelect, Order } from "./codegen/vexnor_dev.schema.js";
import { jsonMany, sql } from "vexnor-mssql";
import { pool } from "./mssql-pool.js";
import { getTag } from "./tags.js";

describe.sequential("jsonMany() tests", (ctx) => {
   const TAG = getTag(ctx);
   let parentAccount!: IAccountSelect;
   let orders!: IOrderSelect[];

   beforeAll(async () => {
      parentAccount = await sql`
         insert into ${Account}
            ${Account.insertCols({
               status: "created",
               firstName: `John-0-${TAG}`,
               lastName: `Doe-0-${TAG}`,
               email: `john.doe-${TAG}@example.com`,
            })}
            output ${row(Account.as(`inserted`).$$)}
            ${Account.insertVals({
               status: "created",
               firstName: `John-0-${TAG}`,
               lastName: `Doe-0-${TAG}`,
               email: `john.doe-${TAG}@example.com`,
            })}
      `.one({ db: pool.request() });
      expect(parentAccount.accountId).toBeDefined();

      const childrenInserts = [
         {
            status: "created" as const,
            firstName: `John-1-${TAG}`,
            lastName: `Doe-1-${TAG}`,
            email: `john.doe-1-${TAG}@example.com`,
            parentId: parentAccount.accountId,
         },
         {
            status: "created" as const,
            firstName: `John-2-${TAG}`,
            lastName: `Doe-2-${TAG}`,
            email: `john.doe-2-${TAG}@example.com`,
            parentId: parentAccount.accountId,
         },
      ];

      const childrenAccounts = await sql`
         insert into ${Account}
            ${Account.insertCols(...childrenInserts)}
            output ${row(Account.as(`inserted`).$$)}
            ${Account.insertVals(...childrenInserts)}
      `.all({ db: pool.request() });
      expect(childrenAccounts).toHaveLength(2);

      const orderInserts = [{ accountId: parentAccount.accountId }, { accountId: parentAccount.accountId }];
      orders = await sql`
         insert into ${Order}
            ${Order.insertCols(...orderInserts)}
            output ${row(Order.as(`inserted`).$$)}
            ${Order.insertVals(...orderInserts)}
      `.mssql.all({ db: pool.request() });
      expect(orders).toHaveLength(2);
   });

   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
      from ${Order}
      where ${Order.$accountId} = ${Account.out.$accountId}
      order by ${Order.$createdAt} desc
      offset 0 rows fetch next ${param<{ limit: number }>("limit")} rows only`;

   test("jsonAgg(): select build - returns correct column in result", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${parentAccount.accountId}
      `;
      const results = await query.mssql.all({ db: pool.request(), params: { limit: 10 } });
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("orders");
   });

   test("jsonAgg(): from - OUTER APPLY produces aggregated results", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${parentAccount.accountId}
      `;
      const results = await query.mssql.all({ db: pool.request(), params: { limit: 10 } });
      expect(results).toHaveLength(1);
      const parsed = results[0]!.orders;
      expect(parsed).toHaveLength(2);
   });

   test("jsonAgg() with params", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${parentAccount.accountId}
         order by ${Account.$accountId}
      `;
      const results = await query.mssql.all({ db: pool.request(), params: { limit: 1 } });
      expect(results).toHaveLength(1);
      const parsed = results[0]!.orders;
      expect(parsed).toHaveLength(1);
   });

   test("jsonMany() E2E: returns aggregated orders for account", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${parentAccount.accountId}
      `;

      const results = await query.mssql.all({ db: pool.request(), params: { limit: 10 } });
      expect(results).toHaveLength(1);
      const parsedOrders = results[0]!.orders;
      expect(parsedOrders).toHaveLength(2);
      expect(parsedOrders.map((o) => o.orderId)).toEqual(expect.arrayContaining(orders.map((o) => o.orderId)));
   });

   test("jsonMany() E2E: returns empty array when no orders", async () => {
      const accountWithNoOrders = await sql`
         insert into ${Account}
            ${Account.insertCols({ status: "created", firstName: "No-orders", lastName: "Account", email: `no-orders-${TAG}@example.com` })}
            output ${row(Account.as(`inserted`).$$)}
            ${Account.insertVals({ status: "created", firstName: "No-orders", lastName: "Account", email: `no-orders-${TAG}@example.com` })}
      `.one({ db: pool.request() });

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${accountWithNoOrders.accountId}
      `;

      const results = await query.mssql.all({ db: pool.request(), params: { limit: 10 } });
      expect(results).toHaveLength(1);
      const parsedOrders = results[0]!.orders;
      expect(parsedOrders).toEqual([]);
   });
});
