import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { param, row } from "valnor";
import { mssqlCrud, sql } from "valnor-mssql";
import { Account, IAccountSelect, IOrderSelect, Order } from "./codegen/valnor_test.schema.js";
import { pool } from "./mssql-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("valnor mssql CRUD - select", async (ctx) => {
   const AccountCrud = mssqlCrud(Account);
   const OrderCrud = mssqlCrud(Order);

   let rootAccount!: IAccountSelect;
   let childAccount!: IAccountSelect;
   let order!: IOrderSelect;

   const dataManager = new TestDataManager(ctx, {
      ACCOUNT_ROOT_COUNT: 1,
      ACCOUNT_CHILD_FACTOR: 1,
      ACCOUNT_ORDER_FACTOR: 1,
   });

   beforeAll(async () => {
      await dataManager.initRootAccounts(pool);
      rootAccount = dataManager.rootAccounts[0]!;
      ok(rootAccount, `no 'rootAccount' initialized.`);

      await dataManager.initChildAccounts(pool);
      childAccount = dataManager.childAccounts[0]!;
      ok(childAccount, `no 'childAccount' initialized.`);

      await dataManager.initOrders(pool);
      order = dataManager.orders[0]!;
      ok(order, `no 'order' initialized.`);
   });

   test("select: basic select with WHERE", async () => {
      ok(rootAccount, `'rootAccount' is required.`);
      const idParam = param<{ id: string }>("id");
      const getAccount = AccountCrud.select!({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      });

      const result = await getAccount.mssql.any({
         db: pool.request(),
         params: { id: rootAccount.accountId },
      });

      expect(result).toMatchObject(rootAccount);
   });

   test("select: with ORDER_BY + offset + limit", async () => {
      ok(rootAccount, `'rootAccount' is required.`);
      const offsetParam = param<{ offset: number }>("offset");
      const limitParam = param<{ limit: number }>("limit");
      const query = AccountCrud.select!({
         WHERE: sql`${Account.$accountId} in (${[rootAccount.accountId, childAccount.accountId]})`,
         ORDER_BY: sql`${Account.$email} asc`,
         offset: offsetParam,
         limit: limitParam,
      });

      const results = await query.mssql.all({
         db: pool.request(),
         params: { offset: 0, limit: 1 },
      });
      expect(results).toHaveLength(1);
   });

   test("select: includeMany (children)", async () => {
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.out.$accountId}
      `;

      const query = AccountCrud.select!({
         WHERE: sql`${Account.$accountId} = ${rootAccount.accountId}`,
         includeMany: { children },
      });

      const results = await query.mssql.all({ db: pool.request() });
      expect(results).toHaveLength(1);
      const parsed = JSON.parse(results[0]!.children as unknown as string) as IAccountSelect[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0]!.accountId).toBe(childAccount.accountId);
   });

   test("select: includeOne (firstOrder)", async () => {
      const query = AccountCrud.select!({
         WHERE: sql`${Account.$accountId} = ${rootAccount.accountId}`,
         includeOne: {
            firstOrder: OrderCrud.select({
               WHERE: sql`${Order.$accountId} = ${Account.out.$accountId} AND ${Order.$orderId} = ${order.orderId}`,
            }),
         },
      });

      const results = await query.mssql.all({ db: pool.request() });
      expect(results).toHaveLength(1);
      const parsed = JSON.parse(results[0]!.firstOrder as unknown as string) as IOrderSelect;
      expect(parsed.orderId).toBe(order.orderId);
   });

   test("select: includeOne returns null when no match", async () => {
      const query = AccountCrud.select!({
         WHERE: sql`${Account.$accountId} = ${rootAccount.accountId}`,
         includeOne: {
            firstOrder: OrderCrud.select({
               WHERE: sql`${Order.$accountId} = ${Account.out.$accountId} AND ${Order.$orderId} = ${crypto.randomUUID()}`,
            }),
         },
      });

      const results = await query.mssql.all({ db: pool.request() });
      expect(results).toHaveLength(1);
      const parsed = JSON.parse(results[0]!.firstOrder as unknown as string);
      expect(parsed).toBeNull();
   });

   test("select: includeMany returns empty array when no match", async () => {
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.out.$accountId}
      `;

      const query = AccountCrud.select!({
         WHERE: sql`${Account.$accountId} = ${childAccount.accountId}`,
         includeMany: { children },
      });

      const results = await query.mssql.all({ db: pool.request() });
      expect(results).toHaveLength(1);
      const parsed = JSON.parse(results[0]!.children as unknown as string) as IAccountSelect[];
      expect(parsed).toEqual([]);
   });

   test("select: includeOne + includeMany combined", async () => {
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.out.$accountId}
      `;

      const query = AccountCrud.select!({
         WHERE: sql`${Account.$accountId} = ${rootAccount.accountId}`,
         includeMany: { children },
         includeOne: {
            firstOrder: OrderCrud.select({
               WHERE: sql`${Order.$accountId} = ${Account.out.$accountId} AND ${Order.$orderId} = ${order.orderId}`,
            }),
         },
      });

      const results = await query.mssql.all({ db: pool.request() });
      expect(results).toHaveLength(1);
      const parsedChildren = JSON.parse(results[0]!.children as unknown as string) as IAccountSelect[];
      expect(parsedChildren).toHaveLength(1);
      expect(parsedChildren[0]!.accountId).toBe(childAccount.accountId);
      const parsedOrder = JSON.parse(results[0]!.firstOrder as unknown as string) as IOrderSelect;
      expect(parsedOrder.orderId).toBe(order.orderId);
   });
});
