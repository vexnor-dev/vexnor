import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { param } from "valnor";
import { postgresCrud, sql } from "valnor-postgres";
import { Account, IAccountSelect, IOrderSelect, Order } from "./codegen/valnor_test.schema.js";
import { pool } from "./postgres-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("valnor postgres CRUD - delete", async (ctx) => {
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

   test("delete: delete order", async () => {
      const query = OrderCrud.delete!({
         WHERE: sql`${Order.$orderId} = ${param<{ id: string }>("id")}`,
      });

      const deleted = await query.getAll({
         db: pool,
         params: { id: order.orderId },
      });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.orderId).toBe(order.orderId);
      order = undefined!;
   });

   test("delete: delete child account", async () => {
      await OrderCrud.delete!({
         WHERE: sql`${Order.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      }).postgres.run({
         db: pool,
         params: { accountId: childAccount.accountId },
      });

      const idParam = param<{ id: string }>("id");
      const query = AccountCrud.delete!({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      });

      const deleted = await query.getAll({
         db: pool,
         params: { id: childAccount.accountId },
      });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId).toBe(childAccount.accountId);
      childAccount = undefined!;
   });

   test("delete: delete root account", async () => {
      ok(rootAccount, `'rootAccount' is required.`);
      await OrderCrud.delete!({
         WHERE: sql`${Order.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      }).postgres.run({
         db: pool,
         params: { accountId: rootAccount.accountId },
      });

      const idParam = param<{ id: string }>("id");
      const delete$ = AccountCrud.delete!({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      });

      const deleted = await delete$.getAll({
         db: pool,
         params: { id: rootAccount.accountId },
      });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId).toBe(rootAccount.accountId);
      rootAccount = undefined!;
   });
});
