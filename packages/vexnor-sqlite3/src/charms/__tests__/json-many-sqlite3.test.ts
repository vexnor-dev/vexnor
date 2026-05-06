import { assertType, describe, expect, test } from "vitest";
import { param, row, sql, SqlBuildContext, SqlCharm, SqlParam } from "vexnor";
import { jsonMany } from "#/charms/json-aggregation-sqlite3.js";
import { Account } from "vexnor/testing";

describe("json-many-sqlite3 tests", () => {
   test("should render select w/o alias", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const AccountChildren = sql`select ${row(Account.$$)} from ${Account.as("children")} where ${Account.as("children").$parentId} = ${Account.$accountId}`;
      const target = jsonMany(AccountChildren);
      target.build(context, {});
      expect(context.text).toMatchInlineSnapshot(`
        "(
          /* <query_0> */
          SELECT
            coalesce(
              json_group_array (json_object ("query_1".*)),
              '[]'
            )
          FROM
            (
              /* <query_1> */
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
                "main"."account" AS "children"
              WHERE
                "children"."parent_id" = "a_1"."account_id" /* </query_1> */
            ) AS "query_1" /* </query_0> */
        )"
      `);
   });

   test("should render select with alias", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const target = jsonMany(
         sql`select ${row(Account.as("children").$$)} from ${Account.as("children")} where ${Account.as("children").$parentId} = ${Account.$accountId}`,
      ).as("children");
      target.build(context);
      expect(context.text).toMatchInlineSnapshot(`
        "/* <query_0> */ (
          SELECT
            coalesce(
              json_group_array (
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
              ),
              '[]'
            )
          FROM
            (
              /* <query_1> */
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
                "children"."parent_id" = "a_1"."account_id" /* </query_1> */
            ) AS "query_1"
        ) AS "children" /* </query_0> */"
      `);
   });

   test("should throw 'from' w/o alias", () => {
      const context = new SqlBuildContext();
      context.next("from");
      const target = jsonMany(
         sql`select ${row(Account.as("children").$$)} from ${Account.as("children")} where ${Account.as("children").$parentId} = ${Account.$accountId}`,
      );
      expect(() => target.build(context, {})).toThrowErrorMatchingInlineSnapshot(
         `
        [TypeError: Error building 'JsonAggregationSqlite3#3(SqlQuery#5)' in query '-'
        Cannot use json aggregation with SQL keyword 'from']
      `,
      );
      expect(context.text).toMatchInlineSnapshot(`""`);
   });

   test("should build full query with json aggregation", () => {
      const AccountChildren = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$parentId} = ${Account.out.$accountId}
         order by ${Account.$createdAt} desc
         limit ${param<{ limit: number }>("limit")}
      `;

      const manyChildren = jsonMany(AccountChildren);
      assertType<SqlCharm<{ Params: { limit: number } }>>(manyChildren);

      const query = sql`
         select ${row(Account.$$)}, ${manyChildren.as("children")}
         from ${Account}
      `;

      expect(query.row.$children).toBeDefined();
      expect(query.params).toMatchObject({
         limit: { name: "limit" },
      });

      expect(query.params.limit).toMatchObject({ name: "limit" });

      const { text } = query.getSql({ params: { limit: 10 }, options: { dialect: "sqlite" } });
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
                  "a_2"."parent_id" = "a_1"."account_id"
                ORDER BY
                  "a_2"."created_at" DESC
                LIMIT
                  ?
                  /* </query_2> */
              ) AS "query_2"
          ) AS "children" /* </query_1> */
        FROM
          "main"."account" AS "a_1"
          /* </query_0> */"
      `);
   });

   test("should include params from inner query", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.$accountId}
         order by ${Account.$createdAt} desc
         limit ${param<{ limit: number }>("limit")}
      `;

      const target = jsonMany(query);
      assertType<SqlCharm<{ Params: { limit: number } }>>(target);
      assertType<{ limit: SqlParam<{ Name: "limit"; Type: number }> }>(target.params);
      expect(target.query.params).toMatchObject({
         limit: { name: "limit" },
      });
   });
});
