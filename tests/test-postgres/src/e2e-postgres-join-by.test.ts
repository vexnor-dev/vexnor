import { beforeAll, describe, expect, test } from "vitest";
import "@vexnor/postgres";
import { SqlTable, sql as coreSql, row } from "@vexnor/core";
import { OrderItem, Order, Account } from "./codegen/vexnor_dev.schema.js";
import { pool } from "./postgres-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("joinBy — e2e postgres (multi-table join + aggregation)", async (ctx) => {
   const dataManager = new TestDataManager(ctx, {
      ACCOUNT_ROOT_COUNT: 3,
      ACCOUNT_CHILD_FACTOR: 0,
      ACCOUNT_ORDER_FACTOR: 2,
      ORDER_ITEM_FACTOR: 3,
   });

   beforeAll(async () => {
      SqlTable.register(Account);
      SqlTable.register(Order);
      SqlTable.register(OrderItem);
      await dataManager.setup(pool);
   });

   test("single join: Order → Account via joinBy param", async () => {
      const query = Order.join({ account: Account }).select({}).postgres;
      const result = await query.all({
         db: pool,
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]] } },
            limit: 5,
         },
      });
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(5);
   });

   test("chained join: OrderItem → Order → Account", async () => {
      const query = OrderItem.join({ order: Order, account: Account }).select({}).postgres;
      const result = await query.all({
         db: pool,
         params: {
            joinBy: {
               order: { on: [["_.orderId", "=", "order.orderId"]] },
               account: { on: [["order.accountId", "=", "account.accountId"]] },
            },
            limit: 5,
         },
      });
      expect(result.length).toBeGreaterThan(0);
   });

   test("join + aggregation: top accounts by order item count", async () => {
      const query = OrderItem.join({ order: Order, account: Account }).select({}).postgres;
      const result = await query.all({
         db: pool,
         params: {
            joinBy: {
               order: { on: [["_.orderId", "=", "order.orderId"]] },
               account: { on: [["order.accountId", "=", "account.accountId"]] },
            },
            select: { "account.email": "account.email", itemCount: { fn: "count", col: "*" } },
            orderBy: { "account.email": "ASC" },
            limit: 3,
         },
      });
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty("email");
   });

   test.todo("join + sum aggregation: total product price per account", async () => {
      const query = OrderItem.join({ order: Order, account: Account }).select({}).postgres;
      const result = await query.all({
         db: pool,
         params: {
            joinBy: {
               order: { on: [["_.orderId", "=", "order.orderId"]] },
               account: { on: [["order.accountId", "=", "account.accountId"]] },
            },
            select: { "account.email": "account.email", totalSpent: { fn: "sum", col: "productPrice" } },
            orderBy: { "account.email": "ASC" },
            limit: 3,
         },
      });
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty("totalSpent");
   });

   test("join + filterBy on joined table column", async () => {
      const email = dataManager.rootAccounts[0]!.email;
      const query = OrderItem.join({ order: Order, account: Account }).select({}).postgres;
      const result = await query.all({
         db: pool,
         params: {
            joinBy: {
               order: { on: [["_.orderId", "=", "order.orderId"]] },
               account: { on: [["order.accountId", "=", "account.accountId"]] },
            },
            filterBy: [{ "account.email": email }],
            limit: 20,
         },
      });
      expect(result.length).toBeGreaterThan(0);
      for (const row of result) {
         expect(row.orderId).toBeDefined();
      }
   });

   test("left join: include orders without items", async () => {
      const query = Order.join({ account: [Account, "left"] }).select({}).postgres;
      const result = await query.all({
         db: pool,
         params: {
            joinBy: { account: { on: [["_.accountId", "=", "account.accountId"]], type: "left" } },
            limit: 10,
         },
      });
      expect(result.length).toBeGreaterThan(0);
   });
});

describe.sequential("JOIN: sql`` — e2e postgres (raw JOIN arg via CRUD handler)", async (ctx) => {
   const dataManager = new TestDataManager(ctx, {
      ACCOUNT_ROOT_COUNT: 2,
      ACCOUNT_CHILD_FACTOR: 0,
      ACCOUNT_ORDER_FACTOR: 2,
      ORDER_ITEM_FACTOR: 2,
   });

   beforeAll(async () => {
      SqlTable.register(Account);
      SqlTable.register(Order);
      SqlTable.register(OrderItem);
      await dataManager.setup(pool);
   });

   test("select with raw JOIN via sql template + postgres execution", async () => {
      const result = await coreSql`
         select ${row(Order.$$)}
         from ${Order}
         join ${Account} on ${Account.$accountId} = ${Order.$accountId}
         limit 5
      `.postgres.all({ db: pool });
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(5);
   });

   test("select with raw JOIN + WHERE via sql template + postgres execution", async () => {
      const email = dataManager.rootAccounts[0]!.email;
      const result = await coreSql`
         select ${row(Order.$$)}
         from ${Order}
         join ${Account} on ${Account.$accountId} = ${Order.$accountId}
         where ${Account.$email} = ${email}
      `.postgres.all({ db: pool });
      expect(result.length).toBeGreaterThan(0);
   });
});
