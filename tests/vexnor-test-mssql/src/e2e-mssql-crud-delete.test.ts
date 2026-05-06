import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { param } from "vexnor";
import { sql } from "vexnor-mssql";
import "vexnor-mssql";
import { Account, IAccountSelect, IOrderSelect, Order } from "./codegen/vexnor_dev.schema.js";
import { pool } from "./mssql-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("vexnor mssql CRUD - delete", async (ctx) => {
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
      const query = Order.mssql.delete({
         WHERE: sql`${Order.$orderId} = ${param<{ id: string }>("id")}`,
      });
      const deleted = await query.all({
         db: pool.request(),
         params: { id: order.orderId },
      });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.orderId).toBe(order.orderId);
      order = undefined!;
   });

   test("delete: delete child account", async () => {
      await Order.mssql.delete({
         WHERE: sql`${Order.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      }).run({
         db: pool.request(),
         params: { accountId: childAccount.accountId },
      });

      const idParam = param<{ id: string }>("id");
      const query = Account.mssql.delete({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      });
      const deleted = await query.all({
         db: pool.request(),
         params: { id: childAccount.accountId },
      });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.accountId).toBe(childAccount.accountId);
      childAccount = undefined!;
   });

   test("delete: delete root account", async () => {
      ok(rootAccount, `'rootAccount' is required.`);
      await Order.mssql.delete({
         WHERE: sql`${Order.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      }).run({
         db: pool.request(),
         params: { accountId: rootAccount.accountId },
      });

      const idParam = param<{ id: string }>("id");
      const delete$ = Account.mssql.delete({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      });
      const { rowsAffected } = await delete$.run({
         db: pool.request(),
         params: { id: rootAccount.accountId },
      });
      expect(rowsAffected[0]).toBe(1);
      rootAccount = undefined!;
   });
});
