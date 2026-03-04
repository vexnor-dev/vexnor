import { beforeAll, describe, expect, test, afterAll } from "vitest";
import { info, param, row, SqlBuildContext } from "valnor";
import { Account, IAccountInsert, Order } from "./codegen/main.schema.js";
import { jsonMany, Sqlite3Tokenizer, sql } from "valnor-sqlite3";
import { db } from "./config.js";

describe.sequential("jsonMany() tests", () => {
   const testAccountIds: string[] = [];

   beforeAll(async () => {
      const parentAccount = await sql`
         insert into ${Account}
            (${Account.$firstName}, ${Account.$lastName}, ${Account.$email}, ${Account.$status})
            values ('John-0', 'Doe-0', 'john.doe@example.com', 'created')
            returning ${row(Account.$$)}
      `.getOneRequired({ db });
      testAccountIds.push(parentAccount.accountId);
      expect(parentAccount.accountId).toBeDefined();

      const childrenInserts: IAccountInsert[] = [
         {
            status: "created",
            firstName: "John-1",
            lastName: "Doe-1",
            email: "john.doe-1@example.com",
            parentId: parentAccount.accountId,
         },
         {
            status: "created",
            firstName: "John-2",
            lastName: "Doe-2",
            email: "john.doe-2@example.com",
            parentId: parentAccount.accountId,
         },
      ];

      for (const child of childrenInserts) {
         const inserted = await sql`
            insert into ${Account}
               (${Account.$firstName}, ${Account.$lastName}, ${Account.$email}, ${Account.$status}, ${Account.$parentId})
               values (${child.firstName}, ${child.lastName}, ${child.email}, ${child.status}, ${child.parentId})
            returning ${row(Account.$$)}
         `.getOneRequired({ db });
         testAccountIds.push(inserted.accountId);
      }
   });

   afterAll(async () => {
      if (testAccountIds.length > 0) {
         await sql`delete from ${Account} where ${Account.$accountId} in (${testAccountIds})`.run({ db });
      }
   });

   const AccountOrders = sql`
      ${info({ label: "AccountOrders" })}
      select ${row(Order.$orderId, Order.$status, Order.$createdAt, Order.$modifiedAt)}
      from ${Order}
      where ${Order.$accountId} = ${Account.out.$accountId}
      order by ${Order.$createdAt} desc
      limit ${param<{ limit: number }>("limit")}`;

   test("jsonMany(): select build", () => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer() });
      context.next("select");
      jsonMany(AccountOrders).build(context, {});
      expect(context.text).toMatchInlineSnapshot(`
        "(
          /* <query_0> */
          SELECT
            coalesce(
              json_group_array (json_object ("AccountOrders".*)),
              '[]'
            )
          FROM
            (
              /* <AccountOrders> */
              /* --label: AccountOrders */
              SELECT
                "o_1"."order_id" AS "orderId",
                "o_1"."status",
                "o_1"."created_at" AS "createdAt",
                "o_1"."modified_at" AS "modifiedAt"
              FROM
                "main"."order" AS "o_1"
              WHERE
                "o_1"."account_id" = "a_2"."account_id"
              ORDER BY
                "o_1"."created_at" DESC
              LIMIT
                ?
                /* </AccountOrders> */
            ) AS "AccountOrders"
            /* </query_0> */
        )"
      `);
   });

   test("jsonMany(): from", () => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer() });
      context.next("from");
      expect(() => jsonMany(AccountOrders).build(context, {})).toThrowErrorMatchingInlineSnapshot(`[TypeError: Cannot use json aggregation with SQL keyword 'from']`);
   });

   test("jsonMany() with params", () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email")}
         order by ${Account.$accountId}
      `;

      const { text, values } = query.getSql({
         params: { email: "test@example.com", limit: 5 },
         options: { dialect: "sqlite" },
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
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          /* <query_1> */
          (
            SELECT
              coalesce(
                json_group_array(
                  json_object(
                    'orderId',
                    "orderId",
                    'status',
                    "status",
                    'createdAt',
                    "createdAt",
                    'modifiedAt',
                    "modifiedAt"
                  )
                ),
                '[]'
              )
            FROM
              (
                /* <AccountOrders> */
                /* --label: AccountOrders */
                SELECT
                  "o_2"."order_id" AS "orderId",
                  "o_2"."status",
                  "o_2"."created_at" AS "createdAt",
                  "o_2"."modified_at" AS "modifiedAt"
                FROM
                  "main"."order" AS "o_2"
                WHERE
                  "o_2"."account_id" = "a_1"."account_id"
                ORDER BY
                  "o_2"."created_at" DESC
                LIMIT
                  ?
                  /* </AccountOrders> */
              ) AS "AccountOrders"
          ) AS "orders"
          /* </query_1> */
        FROM
          "main"."account" AS "a_1"
        WHERE
          "a_1"."email" = ?
        ORDER BY
          "a_1"."account_id"
          /* </query_0> */"
      `);
   });
});
