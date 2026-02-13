import { assertType, describe, expect, test } from "vitest";
import { JsonRow, param, row, sql, SqlBuildContext, SqlCharm, SqlParam, SqlQueryExtended } from "valnor";
import { jsonMany } from "../json-many-postgres.js";
import { Account, IAccountSelect } from "valnor/testing";

describe("json-agg-postgres tests", () => {
   test("should render select w/o alias", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const AccountChildren = sql`select ${row(Account.$$)} from ${Account.as(`children`)} where ${Account.as(`children`).$parentId} = ${Account.$accountId}`;
      const target = jsonMany(AccountChildren);
      target.build(context, {});
      console.log(context.text);
      expect(context.text).toMatchInlineSnapshot(`""query_0_result""`);
   });

   test("should render select with alias", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const target = jsonMany(
         sql`select ${row(Account.as("children").$$)} from ${Account.as(`children`)} where ${Account.as(`children`).$parentId} = ${Account.$accountId}`,
      ).as("children");
      target.build(context);
      console.log(context.text);

      expect(context.text).toMatchInlineSnapshot(`""query_0_result" AS "children""`);
   });

   test("should render from w/o alias", () => {
      const context = new SqlBuildContext();
      context.next("from");
      const target = jsonMany(
         sql`select ${row(Account.as(`children`).$$)} from ${Account.as(`children`)} where ${Account.as(`children`).$parentId} = ${Account.$accountId}`,
      );
      target.build(context, {});
      console.log(context.text);
      expect(context.text).toMatchInlineSnapshot(`
        "LEFT JOIN LATERAL (
          SELECT
            coalesce(jsonb_agg ("query_0".*), '[]') AS "query_0_result"
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
            ) AS "query_0"
        ) AS "query_0" ON TRUE"
      `);
   });

   test("should build full query with json aggregation", () => {
      const AccountChildren = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as(`children`)}
         where ${Account.as(`children`).$parentId} = ${Account.$accountId}
         order by ${Account.as(`children`).$createdAt} desc
         limit ${param<{ limit: number }>("limit")}
      `;

      assertType<SqlCharm<{ Params: { limit: number } }>>(jsonMany(AccountChildren));

      const query = sql`
         select ${row(Account.$$)}, ${jsonMany(AccountChildren).as("children")}
         from ${Account} ${jsonMany(AccountChildren)}
      `;

      assertType<
         SqlQueryExtended<{
            Row: IAccountSelect & { children: JsonRow<IAccountSelect>[] };
            Params: { limit: number };
         }>
      >(query);
      expect(query.row).toMatchObject({
         $accountId: {
            columnName: "accountId",
            format: null,
            key: "accountId",
            params: null,
            tableInfo: null,
            wrap: true,
         },
         $createdAt: {
            columnName: "createdAt",
            format: null,
            key: "createdAt",
            params: null,
            tableInfo: null,
            wrap: true,
         },
         $email: {
            columnName: "email",
            format: null,
            key: "email",
            params: null,
            tableInfo: null,
            wrap: true,
         },
         $firstName: {
            columnName: "firstName",
            format: null,
            key: "firstName",
            params: null,
            tableInfo: null,
            wrap: true,
         },
         $lastName: {
            columnName: "lastName",
            format: null,
            key: "lastName",
            params: null,
            tableInfo: null,
            wrap: true,
         },
         $modifiedAt: {
            columnName: "modifiedAt",
            format: null,
            key: "modifiedAt",
            params: null,
            tableInfo: null,
            wrap: true,
         },
         $notes: {
            columnName: "notes",
            format: null,
            key: "notes",
            params: null,
            tableInfo: null,
            wrap: true,
         },
         $parentId: {
            columnName: "parentId",
            format: null,
            key: "parentId",
            params: null,
            tableInfo: null,
            wrap: true,
         },
         $status: {
            columnName: "status",
            format: null,
            key: "status",
            params: null,
            tableInfo: null,
            wrap: true,
         },
         $children: {
            columnName: "children",
            format: null,
            key: "children",
            params: null,
            tableInfo: null,
            wrap: true,
         },
      });
      expect(query.row.$children).toBeDefined();
      expect(query.params).toMatchObject({
         limit: { name: "limit" },
      });

      expect(query.params.limit).toMatchObject({ name: "limit" });

      const { text } = query.getSql({ params: { limit: 10 }, options: { dialect: "postgresql" } });
      console.log(text);
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
          "query_1_result" AS "children"
        FROM
          "main"."account" AS "a_1"
          LEFT JOIN LATERAL (
            SELECT
              coalesce(jsonb_agg("query_1".*), '[]') AS "query_1_result"
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
              ) AS "query_1"
          ) AS "query_1" ON TRUE"
      `);
   });

   test("should include params from inner query", () => {
      const query = sql`
            select ${row(Account.$$)}
            from ${Account.as(`children`)}
            where ${Account.as(`children`).$parentId} = ${Account.$accountId}
            order by ${Account.$createdAt} desc
            offset 0 rows fetch next ${param<{ limit: number }>("limit")} rows only
         `;

      const target = jsonMany(query);
      assertType<typeof target.params>(target.params);
      expect(target.query.params).toMatchObject({
         limit: { name: "limit" },
      });
   });

   test("should include params from inner query", () => {
      const query = sql`
            select ${row(Account.$$)}
            from ${Account.as(`children`)}
            where ${Account.as(`children`).$parentId} = ${Account.$accountId}
            order by ${Account.$createdAt} desc
            offset 0 rows fetch next ${param<{ limit: number }>("limit")} rows only
         `;

      const target = jsonMany(query);
      assertType<SqlCharm<{ Params: { limit: number } }>>(target);
      assertType<{ limit: SqlParam<{ Name: "limit"; Type: number }> }>(target.params);
      expect(target.query.params).toMatchObject({
         limit: { name: "limit" },
      });
   });
});
