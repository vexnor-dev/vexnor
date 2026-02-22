import { assertType, describe, expect, test } from "vitest";
import { param, row, sql, SqlBuildContext, SqlCharm, SqlParam } from "valnor";
import { jsonMany } from "../json-many-sqlite3.js";
import { Account } from "valnor/testing";

describe("json-group-array-sqlite3 tests", () => {
   test("should render select w/o alias", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const AccountChildren = sql`select ${row(Account.$$)} from ${Account.as(`children`)} where ${Account.as(`children`).$parentId} = ${Account.$accountId}`;
      const target = jsonMany(AccountChildren);
      target.build(context, {});
      expect(context.text).toMatchInlineSnapshot(`
        "(
          SELECT
            coalesce(
              json_group_array (json_object ("query_1".*)),
              '[]'
            )
          FROM
            (
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
                "children"."parent_id" = "a_1"."account_id"
            ) AS "query_1"
        )"
      `);
   });

   test("should render select with alias", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const target = jsonMany(
         sql`select ${row(Account.as("children").$$)} from ${Account.as(`children`)} where ${Account.as(`children`).$parentId} = ${Account.$accountId}`,
      ).as("children");
      target.build(context);
      expect(context.text).toMatchInlineSnapshot(`
        "(
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
                "children"."parent_id" = "a_1"."account_id"
            ) AS "query_1"
        ) AS "children""
      `);
   });

   test("should render from w/o alias", () => {
      const context = new SqlBuildContext();
      context.next("from");
      const target = jsonMany(
         sql`select ${row(Account.as(`children`).$$)} from ${Account.as(`children`)} where ${Account.as(`children`).$parentId} = ${Account.$accountId}`,
      );
      target.build(context, {});
      expect(context.text).toMatchInlineSnapshot(`""`);
   });

   test("should build full query with json aggregation", () => {
      const AccountChildren = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as(`children`)}
         where ${Account.as(`children`).$parentId} = ${Account.out.$accountId}
         order by ${Account.as(`children`).$createdAt} desc
         limit ${param<{ limit: number }>("limit")}
      `;

      assertType<SqlCharm<{ Params: { limit: number } }>>(jsonMany(AccountChildren));

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountChildren).as("children")}
         from ${Account}
      `;

      expect(query.params).toMatchObject({
         limit: { name: "limit" },
      });

      const { text } = query.getSql({ params: { limit: 10 }, options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          (
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
                  "children"."parent_id" = "a_1"."account_id"
                ORDER BY
                  "children"."created_at" DESC
                LIMIT
                  ?
              ) AS "query_2"
          ) AS "children"
        FROM
          "main"."account" AS "a_1""
      `);
   });

   test("should include params from inner query", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account.as(`children`)}
         where ${Account.as(`children`).$parentId} = ${Account.$accountId}
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

   test("should handle ORDER BY within subquery", () => {
      const AccountChildren = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as(`children`)}
         where ${Account.as(`children`).$parentId} = ${Account.out.$accountId}
         order by ${Account.as(`children`).$createdAt} desc
      `;

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountChildren).as("children")}
         from ${Account} ${jsonMany(AccountChildren)}
      `;

      const { text } = query.getSql({ options: { dialect: "sqlite" } });
      expect(text).toMatchInlineSnapshot(`
        "SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          (
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
                  "children"."parent_id" = "a_1"."account_id"
                ORDER BY
                  "children"."created_at" DESC
              ) AS "query_2"
          ) AS "children"
        FROM
          "main"."account" AS "a_1""
      `);
   });
});
