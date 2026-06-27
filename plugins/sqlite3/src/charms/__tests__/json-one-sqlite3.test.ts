import { assertType, beforeEach, describe, expect, test } from "vitest";
import { param, row, sql, SqlBuildContext, SqlCharm, SqlParam } from "@vexnor/core";
import { jsonOne } from "#src/charms/json-aggregation-sqlite3.js";
import { Account, resetAll } from "@vexnor/core/testing";

beforeEach(() => resetAll());

describe("json-one-sqlite3 tests", () => {
   test("should render select w/o alias", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const AccountParent = sql`select ${row(Account.$$)} from ${Account.as("parent")} where ${Account.as("parent").$accountId} = ${Account.$parentId}`;
      const target = jsonOne(AccountParent);
      target.build(context, {});
      expect(context.text).toMatchInlineSnapshot(`
        "(
          /* <query_0> */
          SELECT
            json_object ("query_1".*)
          FROM
            (
              /* <query_1> */
              SELECT
                "query_2".*
              FROM
                (
                  /* <query_2> */
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
                    "main"."account" AS "parent"
                  WHERE
                    "parent"."account_id" = "a_1"."parent_id" /* </query_2> */
                ) AS "query_2"
              LIMIT
                1 /* </query_1> */
            ) AS "query_1"
          LIMIT
            1 /* </query_0> */
        )"
      `);
   });

   test("should render select with alias", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const target = jsonOne(
         sql`select ${row(Account.as("parent").$$)} from ${Account.as("parent")} where ${Account.as("parent").$accountId} = ${Account.$parentId}`,
      ).as("parent");
      target.build(context);
      expect(context.text).toMatchInlineSnapshot(`
        "/* <query_0> */ (
          SELECT
            json_object (
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
          FROM
            (
              /* <query_1> */
              SELECT
                "query_2".*
              FROM
                (
                  /* <query_2> */
                  SELECT
                    "parent"."account_id" AS "accountId",
                    "parent"."status",
                    "parent"."email",
                    "parent"."first_name" AS "firstName",
                    "parent"."last_name" AS "lastName",
                    "parent"."notes",
                    "parent"."created_at" AS "createdAt",
                    "parent"."modified_at" AS "modifiedAt",
                    "parent"."parent_id" AS "parentId"
                  FROM
                    "main"."account" AS "parent"
                  WHERE
                    "parent"."account_id" = "a_1"."parent_id" /* </query_2> */
                ) AS "query_2"
              LIMIT
                1 /* </query_1> */
            ) AS "query_1"
          LIMIT
            1
        ) AS "parent" /* </query_0> */"
      `);
   });

   test("should throw 'from' w/o alias", () => {
      const context = new SqlBuildContext();
      context.next("from");
      const target = jsonOne(
         sql`select ${row(Account.as("parent").$$)} from ${Account.as("parent")} where ${Account.as("parent").$accountId} = ${Account.$parentId}`,
      );
      expect(() => target.build(context, {})).toThrowErrorMatchingInlineSnapshot(
         `[TypeError: Error building 'JsonAggregationSqlite3#1(SqlQuery#2)' in query '-'\\nCannot use json aggregation with SQL keyword 'from']`,
      );
   });

   test("should build full query with json aggregation", () => {
      const AccountParent = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} = ${Account.out.$parentId}
         limit ${param<{ limit: number }>("limit")}
      `;

      const oneParent = jsonOne(AccountParent);
      assertType<SqlCharm<{ Params: { limit: number } }>>(oneParent);

      const query = sql`
         select ${row(Account.$$)}, ${oneParent.as("parent")}
         from ${Account}
      `;

      expect(query.row.$parent).toBeDefined();
      expect(query.params.limit).toMatchObject({ name: "limit" });

      const { text } = query.getSql({ params: { limit: 1 }, options: { dialect: "sqlite" } });
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
          /* <query_1> */ (
            SELECT
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
            FROM
              (
                /* <query_2> */
                SELECT
                  "query_3".*
                FROM
                  (
                    /* <query_3> */
                    SELECT
                      "a_2"."account_id" AS "accountId",
                      "a_2"."status",
                      "a_2"."email",
                      "a_2"."first_name" AS "firstName",
                      "a_2"."last_name" AS "lastName",
                      "a_2"."notes",
                      "a_2"."created_at" AS "createdAt",
                      "a_2"."modified_at" AS "modifiedAt",
                      "a_2"."parent_id" AS "parentId"
                    FROM
                      "main"."account" AS "a_2"
                    WHERE
                      "a_2"."account_id" = "a_1"."parent_id"
                    LIMIT
                      ?
                      /* </query_3> */
                  ) AS "query_3"
                LIMIT
                  1 /* </query_2> */
              ) AS "query_2"
            LIMIT
              1
          ) AS "parent" /* </query_1> */
        FROM
          "main"."account" AS "a_1"
          /* </query_0> */"
      `);
   });

   test("should include params from inner query", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account.as("parent")}
         where ${Account.as("parent").$accountId} = ${Account.$parentId}
         limit ${param<{ limit: number }>("limit")}
      `;

      const target = jsonOne(query);
      assertType<SqlCharm<{ Params: { limit: number } }>>(target);
      assertType<{ limit: SqlParam<{ Name: "limit"; Type: number }> }>(target.params);
      expect(target.query.params).toMatchObject({
         limit: { name: "limit" },
      });
   });
});
