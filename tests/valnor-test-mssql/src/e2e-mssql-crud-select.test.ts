import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { param, row } from "valnor";
import { defaultQueryOptions, mssqlCrud, sql } from "valnor-mssql";
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

      const { text, values } = getAccount.getSql({
         params: { id: rootAccount.accountId },
         options: defaultQueryOptions,
      });
      expect(values).toMatchObject([rootAccount.accountId]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."parent_id" AS "parentId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt"
        FROM
          "valnor_test"."account" AS "a_1"
          /* <query_1> */
        WHERE
          /* <query_2> */ "a_1"."account_id" = @param_0 /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
      const result = await getAccount.mssql.getOneOptional({
         db: pool.request(),
         params: { id: rootAccount.accountId },
         options: defaultQueryOptions,
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
      const { text, values } = query.getSql({ params: { limit: 10, offset: 10 }, options: defaultQueryOptions });
      expect(values).toMatchObject([rootAccount.accountId, childAccount.accountId, 10, 10]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."parent_id" AS "parentId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt"
        FROM
          "valnor_test"."account" AS "a_1"
          /* <query_1> */
        WHERE
          /* <query_2> */ "a_1"."account_id" IN (@param_0, @param_1) /* </query_2> */ /* </query_1> */
          /* <query_3> */
        ORDER BY
          /* <query_4> */ "a_1"."email" ASC /* </query_4> */ /* </query_3> */
          /* <query_5> */
        OFFSET
          @param_2 rows /* </query_5> */
          /* <query_6> */
        FETCH NEXT
          @param_3 rows only /* </query_6> */
          /* </query_0> */"
      `);
      const results = await query.mssql.getAll({
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
      const { text, values } = query.getSql({ options: defaultQueryOptions });
      expect(values).toMatchObject([rootAccount.accountId]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."parent_id" AS "parentId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "query_1_result"."query_1" AS "children"
        FROM
          "valnor_test"."account" AS "a_1" /* <query_2> */
          OUTER APPLY (
            SELECT
              coalesce(
                (
                  /* <query_1> */
                  SELECT
                    "children"."account_id" AS "accountId",
                    "children"."parent_id" AS "parentId",
                    "children"."status",
                    "children"."email",
                    "children"."first_name" AS "firstName",
                    "children"."last_name" AS "lastName",
                    "children"."notes",
                    "children"."created_at" AS "createdAt",
                    "children"."modified_at" AS "modifiedAt"
                  FROM
                    "valnor_test"."account" AS "children"
                  WHERE
                    "children"."parent_id" = "a_1"."account_id"
                    /* </query_1> */
                  FOR JSON
                    path,
                    include_null_values
                ),
                '[]'
              ) AS "query_1"
          ) AS "query_1_result" /* </query_2> */
          /* <query_3> */
        WHERE
          /* <query_4> */ "a_1"."account_id" = @param_0 /* </query_4> */ /* </query_3> */
          /* </query_0> */"
      `);
      const results = await query.mssql.getAll({ db: pool.request() });
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
      const { text, values } = query.getSql({ options: defaultQueryOptions });
      expect(values).toMatchObject([order.orderId, rootAccount.accountId]);
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: transactsql */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."parent_id" AS "parentId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "query_1_result"."query_1" AS "firstOrder"
        FROM
          "valnor_test"."account" AS "a_1" /* <query_3> */
          OUTER APPLY (
            SELECT
              coalesce(
                (
                  /* <query_1> */
                  SELECT
                    TOP 1 "query_2".*
                  FROM
                    (
                      /* <query_2> */
                      SELECT
                        "o_2"."order_id" AS "orderId",
                        "o_2"."status",
                        "o_2"."created_at" AS "createdAt",
                        "o_2"."modified_at" AS "modifiedAt",
                        "o_2"."account_id" AS "accountId"
                      FROM
                        "valnor_test"."order" AS "o_2"
                        /* <query_4> */
                      WHERE
                        /* <query_5> */ "o_2"."account_id" = "a_1"."account_id"
                        AND "o_2"."order_id" = @param_0 /* </query_5> */ /* </query_4> */
                        /* </query_2> */
                    ) AS "query_2" /* </query_1> */
                  FOR JSON
                    path,
                    WITHOUT_ARRAY_WRAPPER,
                    include_null_values
                ),
                NULL
              ) AS "query_1"
          ) AS "query_1_result" /* </query_3> */
          /* <query_6> */
        WHERE
          /* <query_7> */ "a_1"."account_id" = @param_1 /* </query_7> */ /* </query_6> */
          /* </query_0> */"
      `);
      const results = await query.mssql.getAll({ db: pool.request() });
      expect(results).toHaveLength(1);
      const parsed = JSON.parse(results[0]!.firstOrder as unknown as string) as IOrderSelect;
      expect(parsed.orderId).toBe(order.orderId);
   });
});
