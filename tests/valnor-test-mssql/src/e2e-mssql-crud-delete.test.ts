import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { param } from "valnor";
import { defaultQueryOptions, mssqlCrud, sql } from "valnor-mssql";
import { Account, IAccountSelect, IOrderSelect, Order } from "./codegen/valnor_test.schema.js";
import { pool } from "./mssql-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("valnor mssql CRUD - delete", async (ctx) => {
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

   test("delete: delete order", async () => {
      const query = OrderCrud.delete!({
         WHERE: sql`${Order.$orderId} = ${param<{ id: string }>("id")}`,
      });
      const { text, values } = query.getSql({
         params: { id: order.orderId },
         options: defaultQueryOptions,
      });
      expect(values).toMatchObject([order.orderId]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        DELETE FROM "valnor_test"."order" output "deleted"."order_id" AS "orderId",
        "deleted"."status",
        "deleted"."created_at" AS "createdAt",
        "deleted"."modified_at" AS "modifiedAt",
        "deleted"."account_id" AS "accountId"
        /* <query_1> */
        WHERE
          /* <query_2> */ "order"."order_id" = @param_0 /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
      const deleted = await query.getAll({
         db: pool.request(),
         params: { id: order.orderId },
      });
      expect(deleted).toHaveLength(1);
      expect(deleted[0]!.orderId).toBe(order.orderId);
      order = undefined!;
   });

   test("delete: delete child account", async () => {
      await OrderCrud.delete!({
         WHERE: sql`${Order.$accountId} = ${param<{ accountId: string }>("accountId")}`,
      }).mssql.run({
         db: pool.request(),
         params: { accountId: childAccount.accountId },
      });

      const idParam = param<{ id: string }>("id");
      const query = AccountCrud.delete!({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      });
      const { text, values } = query.getSql({
         params: { id: childAccount.accountId },
         options: defaultQueryOptions,
      });
      expect(values).toMatchObject([childAccount.accountId]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        DELETE FROM "valnor_test"."account" output "deleted"."account_id" AS "accountId",
        "deleted"."parent_id" AS "parentId",
        "deleted"."status",
        "deleted"."email",
        "deleted"."first_name" AS "firstName",
        "deleted"."last_name" AS "lastName",
        "deleted"."notes",
        "deleted"."created_at" AS "createdAt",
        "deleted"."modified_at" AS "modifiedAt"
        /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = @param_0 /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
      const deleted = await query.getAll({
         db: pool.request(),
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
      }).mssql.run({
         db: pool.request(),
         params: { accountId: rootAccount.accountId },
      });

      const idParam = param<{ id: string }>("id");
      const delete$ = AccountCrud.delete!({
         WHERE: sql`${Account.$accountId} = ${idParam}`,
      });
      const { text, values } = delete$.getSql({
         params: { id: rootAccount.accountId },
         options: defaultQueryOptions,
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        DELETE FROM "valnor_test"."account" output "deleted"."account_id" AS "accountId",
        "deleted"."parent_id" AS "parentId",
        "deleted"."status",
        "deleted"."email",
        "deleted"."first_name" AS "firstName",
        "deleted"."last_name" AS "lastName",
        "deleted"."notes",
        "deleted"."created_at" AS "createdAt",
        "deleted"."modified_at" AS "modifiedAt"
        /* <query_1> */
        WHERE
          /* <query_2> */ "account"."account_id" = @param_0 /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
      expect(values).toMatchObject([rootAccount.accountId]);
      const { rowsAffected } = await delete$.mssql.run({
         db: pool.request(),
         params: { id: rootAccount.accountId },
      });
      expect(rowsAffected[0]).toBe(1);
      rootAccount = undefined!;
   });
});
