import { beforeAll, describe, expect, test } from "vitest";
import { info, param, row, SqlBuildContext } from "valnor";
import { Account, IAccountInsert, Order } from "./codegen/valnor_test.schema.js";
import { defaultQueryOptions, jsonMany, MssqlTokenizer, sql } from "valnor-mssql";
import { pool } from "./mssql-pool.js";
import { getTag } from "./tags.js";

describe.sequential("jsonMany() tests", (ctx) => {
   const TAG = getTag(ctx);

   beforeAll(async () => {
      const parentAccount = await sql`
         insert into ${Account}
            ${Account.insertCols({
               status: "created",
               firstName: `John-0-${TAG}}`,
               lastName: `Doe-0-${TAG}}`,
               email: `john.doe-${TAG}@example.com`,
            })}
            output ${row(Account.as(`inserted`).$$)}
            ${Account.insertVals({
               status: "created",
               firstName: `John-0-${TAG}}`,
               lastName: `Doe-0-${TAG}}`,
               email: `john.doe-${TAG}@example.com`,
            })}
      `.getOneRequired({ db: pool.request() });
      expect(parentAccount.accountId).toBeDefined();

      const childrenInserts: IAccountInsert[] = [
         {
            status: "created",
            firstName: `John-1-${TAG}`,
            lastName: "Doe-1-${TAG}",
            email: `john.doe-1-${TAG}@example.com`,
            parentId: parentAccount.accountId,
         },
         {
            status: "created",
            firstName: `John-2-${TAG}`,
            lastName: `Doe-2-${TAG}`,
            email: `john.doe-2-${TAG}@example.com`,
            parentId: parentAccount.accountId,
         },
      ];

      const insertChildren = sql`
         insert into ${Account}
            ${Account.insertCols(...childrenInserts)}
            output ${row(Account.as(`inserted`).$$)}
            ${Account.insertVals(...childrenInserts)}
      `;
      const childrenAccounts = await insertChildren.getAll({ db: pool.request() });
      expect(childrenAccounts).toHaveLength(2);

      console.log("children", childrenAccounts);
   });

   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
      from ${Order}
      where ${Order.$accountId} = ${Account.out.$accountId}
      order by ${Order.$createdAt} desc
      offset 0 rows fetch next ${param<{ limit: number }>("limit")} rows only`;

   test("jsonAgg(): select build", () => {
      const context = new SqlBuildContext({ tokenizer: new MssqlTokenizer() });
      context.next("select");
      jsonMany(AccountOrders).build(context, {});
      expect(context.text).toMatchInlineSnapshot(`""AccountOrders_result"."AccountOrders""`);
   });

   test("jsonAgg(): from", () => {
      const context = new SqlBuildContext({ tokenizer: new MssqlTokenizer() });
      context.next("from");
      context.setAlias(Account.tableInfo, { alias: "a_out" });
      jsonMany(AccountOrders).build(context, {});
      expect(context.text).toMatchInlineSnapshot(`
        "/* <query_1> */ OUTER apply (
          SELECT
            coalesce(
              (
                /* <AccountOrders> */
                /* label: AccountOrders */
                SELECT
                  "o_1"."order_id" AS "orderId",
                  "o_1"."status",
                  "o_1"."created_at" AS "createdAt",
                  "o_1"."modified_at" AS "modifiedAt"
                FROM
                  "valnor_test"."order" AS "o_1"
                WHERE
                  "o_1"."account_id" = "a_out"."account_id"
                ORDER BY
                  "o_1"."created_at" DESC
                OFFSET
                  0 ROWS
                FETCH NEXT
                  ? ROWS ONLY /* </AccountOrders> */ FOR json path,
                  include_null_values
              ),
              '[]'
            ) AS "AccountOrders"
        ) AS "AccountOrders_result" /* </query_1> */"
      `);
   });

   test("jsonAgg() with params", () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$email} = ${param<{ email: string }>("email")}
         order by ${Account.$accountId}
      `;

      const { text, values } = query.getSql({
         params: { email: "test@example.com", limit: 5 },
         options: defaultQueryOptions,
      });

      expect(values).toMatchInlineSnapshot(`
        [
          5,
          "test@example.com",
        ]
      `);
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
          "a_1"."modified_at" AS "modifiedAt",
          "AccountOrders_result"."AccountOrders" AS "orders"
        FROM
          "valnor_test"."account" AS "a_1" /* <query_2> */
          OUTER APPLY (
            SELECT
              coalesce(
                (
                  /* <AccountOrders> */
                  /* label: AccountOrders */
                  SELECT
                    "o_2"."order_id" AS "orderId",
                    "o_2"."status",
                    "o_2"."created_at" AS "createdAt",
                    "o_2"."modified_at" AS "modifiedAt"
                  FROM
                    "valnor_test"."order" AS "o_2"
                  WHERE
                    "o_2"."account_id" = "a_1"."account_id"
                  ORDER BY
                    "o_2"."created_at" DESC
                  OFFSET
                    0 rows
                  FETCH NEXT
                    @param_0 rows only /* </AccountOrders> */
                  FOR JSON
                    path,
                    include_null_values
                ),
                '[]'
              ) AS "AccountOrders"
          ) AS "AccountOrders_result" /* </query_2> */
        WHERE
          "a_1"."email" = @param_1
        ORDER BY
          "a_1"."account_id"
          /* </query_0> */"
      `);
   });
});
