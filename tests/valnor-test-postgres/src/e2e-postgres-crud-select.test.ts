import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { param, row } from "valnor";
import { postgresCrud, sql } from "valnor-postgres";
import { Account, IAccountSelect, IOrderSelect, Order } from "./codegen/valnor_test.schema.js";
import { pool } from "./postgres-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("valnor postgres CRUD - select", async (ctx) => {
   const AccountCrud = postgresCrud(Account);
   const OrderCrud = postgresCrud(Order);

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

      const result = await getAccount.postgres.getOneOptional({
         db: pool,
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

      const results = await query.postgres.getAll({
         db: pool,
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

      const results = await query.postgres.getAll({ db: pool });
      expect(results).toHaveLength(1);
      expect(results[0]!.children).toHaveLength(1);
      expect(results[0]!.children[0]!.accountId).toBe(childAccount.accountId);
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

      const results = await query.postgres.getAll({ db: pool });
      expect(results).toHaveLength(1);
      expect(results[0]!.firstOrder?.orderId).toBe(order.orderId);
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

      const results = await query.postgres.getAll({ db: pool });
      expect(results).toHaveLength(1);
      expect(results[0]!.firstOrder).toBeNull();
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

      const results = await query.postgres.getAll({ db: pool });
      expect(results).toHaveLength(1);
      expect(results[0]!.children).toEqual([]);
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

      const results = await query.postgres.getAll({ db: pool });
      expect(results).toHaveLength(1);
      expect(results[0]!.children).toHaveLength(1);
      expect(results[0]!.children[0]!.accountId).toBe(childAccount.accountId);
      expect(results[0]!.firstOrder?.orderId).toBe(order.orderId);
   });
});
