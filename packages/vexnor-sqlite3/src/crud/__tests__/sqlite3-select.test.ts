// noinspection SqlNoDataSourceInspection,SqlResolve
import "vexnor-sqlite3";
import { assertType, describe, expect, test } from "vitest";
import { Account, Order } from "vexnor/testing";
import { sql, row, col, param, input, ParamsOf } from "vexnor";
import { sqlite3Select } from "#/crud/sqlite3-select.js";
import { defaultQueryOptions } from "#/crud/default-query-options.js";

describe("sqlite3Select()", () => {
   test("basic select", () => {
      const query = sqlite3Select(Account, {});
      const { text } = query.source.getSql({ options: defaultQueryOptions });
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
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
          /* </query_0> */"
      `);
   });

   test("basic select - has $$ and row", () => {
      const query = sqlite3Select(Account, {});
      expect(query.source.$$).toBeDefined();
      expect(query.source.row).toBeDefined();
      expect(query.source.row.$accountId).toBeDefined();
   });

   test("with WHERE", () => {
      const params = input<{ id: string }>();
      const query = sqlite3Select(Account, { WHERE: sql`${Account.$accountId} = ${params.$id}` });
      const { text } = query.source.getSql({ params: { id: "test-id" }, options: defaultQueryOptions });
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
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
        WHERE
          /* <query_2> */ "a_1"."account_id" = ? /* </query_2> */ /* </query_1> */
          /* </query_0> */"
      `);
   });

   test("with ORDER_BY + offset + limit", () => {
      const offsetParam = param<{ offset: number }>("offset");
      const limitParam = param<{ limit: number }>("limit");
      const query = sqlite3Select(Account, {
         ORDER_BY: sql`${Account.$createdAt} desc`,
         offset: offsetParam,
         limit: limitParam,
      });
      const { text, values } = query.source.getSql({ params: { offset: 0, limit: 10 }, options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
        ORDER BY
          /* <query_2> */ "a_1"."created_at" DESC /* </query_2> */ /* </query_1> */
          /* <query_3> */
        LIMIT
          ? /* </query_3> */
          /* <query_4> */
        OFFSET
          ? /* </query_4> */
          /* </query_0> */"
      `);
      expect(values).toMatchObject([10, 0]);
   });

   test("with includeMany", () => {
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.$accountId}
      `;
      const query = sqlite3Select(Account, { includeMany: { children } });
      const { text } = query.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
          /* <query_1> */ (
            SELECT
              coalesce(
                json_group_array(
                  json_object(
                    'accountId',
                    "accountId",
                    'status',
                    "status",
                    'email',
                    "email",
                    'firstName',
                    "firstName",
                    'lastName',
                    "lastName",
                    'notes',
                    "notes",
                    'createdAt',
                    "createdAt",
                    'modifiedAt',
                    "modifiedAt",
                    'parentId',
                    "parentId"
                  )
                ),
                '[]'
              )
            FROM
              (
                /* <query_2> */
                SELECT
                  "children"."account_id" AS "accountId",
                  "children"."status",
                  "children"."email",
                  "children"."first_name" AS "firstName",
                  "children"."last_name" AS "lastName",
                  "children"."notes",
                  "children"."created_at" AS "createdAt",
                  "children"."modified_at" AS "modifiedAt",
                  "children"."parent_id" AS "parentId"
                FROM
                  "main"."account" AS "children"
                WHERE
                  "children"."parent_id" = "a_2"."account_id"
                  /* </query_2> */
              ) AS "query_2"
          ) AS "children" /* </query_1> */
        FROM
          "main"."account" AS "a_1"
          /* </query_0> */"
      `);
   });

   test("with includeOne", () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const query = sqlite3Select(Account, { includeOne: { firstOrder } });
      const { text } = query.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
          /* <query_1> */ (
            SELECT
              json_object(
                'orderId',
                "orderId",
                'status',
                "status",
                'createdAt',
                "createdAt",
                'modifiedAt',
                "modifiedAt",
                'accountId',
                "accountId"
              )
            FROM
              (
                /* <query_2> */
                SELECT
                  "query_3".*
                FROM
                  (
                    /* <query_3> */
                    SELECT
                      "o_2"."order_id" AS "orderId",
                      "o_2"."status",
                      "o_2"."created_at" AS "createdAt",
                      "o_2"."modified_at" AS "modifiedAt",
                      "o_2"."account_id" AS "accountId"
                    FROM
                      "main"."order" AS "o_2"
                    WHERE
                      "o_2"."account_id" = "a_3"."account_id"
                      /* </query_3> */
                  ) AS "query_3"
                LIMIT
                  1 /* </query_2> */
              ) AS "query_2"
            LIMIT
              1
          ) AS "firstOrder" /* </query_1> */
        FROM
          "main"."account" AS "a_1"
          /* </query_0> */"
      `);
   });

   test("with includeOne + includeMany combined", () => {
      const firstOrder = sql`
         select ${row(Order.$$)}
         from ${Order}
         where ${Order.$accountId} = ${Account.$accountId}
      `;
      const children = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.$accountId}
      `;
      const query = sqlite3Select(Account, { includeOne: { firstOrder }, includeMany: { children } });
      const { text } = query.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        /* driver: sqlite */
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
          /* <query_1> */ (
            SELECT
              json_object(
                'orderId',
                "orderId",
                'status',
                "status",
                'createdAt',
                "createdAt",
                'modifiedAt',
                "modifiedAt",
                'accountId',
                "accountId"
              )
            FROM
              (
                /* <query_2> */
                SELECT
                  "query_3".*
                FROM
                  (
                    /* <query_3> */
                    SELECT
                      "o_2"."order_id" AS "orderId",
                      "o_2"."status",
                      "o_2"."created_at" AS "createdAt",
                      "o_2"."modified_at" AS "modifiedAt",
                      "o_2"."account_id" AS "accountId"
                    FROM
                      "main"."order" AS "o_2"
                    WHERE
                      "o_2"."account_id" = "a_3"."account_id"
                      /* </query_3> */
                  ) AS "query_3"
                LIMIT
                  1 /* </query_2> */
              ) AS "query_2"
            LIMIT
              1
          ) AS "firstOrder" /* </query_1> */,
          /* <query_4> */ (
            SELECT
              coalesce(
                json_group_array(
                  json_object(
                    'accountId',
                    "accountId",
                    'status',
                    "status",
                    'email',
                    "email",
                    'firstName',
                    "firstName",
                    'lastName',
                    "lastName",
                    'notes',
                    "notes",
                    'createdAt',
                    "createdAt",
                    'modifiedAt',
                    "modifiedAt",
                    'parentId',
                    "parentId"
                  )
                ),
                '[]'
              )
            FROM
              (
                /* <query_5> */
                SELECT
                  "children"."account_id" AS "accountId",
                  "children"."status",
                  "children"."email",
                  "children"."first_name" AS "firstName",
                  "children"."last_name" AS "lastName",
                  "children"."notes",
                  "children"."created_at" AS "createdAt",
                  "children"."modified_at" AS "modifiedAt",
                  "children"."parent_id" AS "parentId"
                FROM
                  "main"."account" AS "children"
                WHERE
                  "children"."parent_id" = "a_4"."account_id"
                  /* </query_5> */
              ) AS "query_5"
          ) AS "children" /* </query_4> */
        FROM
          "main"."account" AS "a_1"
          /* </query_0> */"
      `);
   });

   test("with SELECT override — full subquery inlines into SELECT clause", () => {
      const orderCount = col<{ orderCount: number }>("orderCount");
      const query = sqlite3Select(Account, {
         SELECT: sql`${row(Account.$$)}, (select count(*) from ${Order} where ${Order.$accountId} = ${Account.$accountId}) as ${orderCount}`,
      });
      const { text } = query.source.getSql({ options: defaultQueryOptions });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          (
            /* <query_1> */ "a_1"."account_id",
            "a_1"."status",
            "a_1"."email",
            "a_1"."first_name",
            "a_1"."last_name",
            "a_1"."notes",
            "a_1"."created_at",
            "a_1"."modified_at",
            "a_1"."parent_id",
            (
              SELECT
                count(*)
              FROM
                "main"."order" AS "o_2"
              WHERE
                "o_2"."account_id" = "a_1"."account_id"
            ) AS "orderCount" /* </query_1> */
          ) AS "query_1"
        FROM
          "main"."account" AS "a_3"
          /* </query_0> */"
      `);
   });
});

describe("param propagation through SqlSelectArgs clauses", () => {
   const emailParam = param<{ email: string }>("email");
   const dirParam = param<{ dir: string }>("dir");
   const limitParam = param<{ limit: number }>("limit");

   test("param in includeMany subquery propagates to ParamsOf query", () => {
      const orders = sql`
            select ${row(Order.$$)}
            from ${Order}
            where ${Order.$accountId} = ${Account.out.$accountId}
            limit ${limitParam}
         `;
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sqlite3Select(Account, {
         WHERE: sql`${Account.$email} = ${emailParam}`,
         ORDER_BY: sql`${Account.$createdAt} ${dirParam}`,
         includeMany: { orders },
      });
      type Params = ParamsOf<typeof query>;
      assertType<Params>({
         email: "a@b.com",
         dir: "desc",
         limit: 5,
         // @ts-expect-error not declared
         other: "x",
      });
   });

   test("param in includeOne subquery propagates to ParamsOf query", () => {
      const lastOrder = sql`
            select ${row(Order.$$)}
            from ${Order}
            where ${Order.$accountId} = ${Account.out.$accountId}
            limit ${limitParam}
         `;
      // eslint-disable-next-line unused-imports/no-unused-vars
      const query = sqlite3Select(Account, {
         WHERE: sql`${Account.$email} = ${emailParam}`,
         ORDER_BY: sql`${Account.$createdAt} ${dirParam}`,
         includeOne: { lastOrder },
      });
      type Params = ParamsOf<typeof query>;
      assertType<Params>({
         email: "a@b.com",
         dir: "desc",
         limit: 1,
         // @ts-expect-error not declared
         other: "x",
      });
   });
});
