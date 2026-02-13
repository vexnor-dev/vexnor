import { assertType, describe, expect, test } from "vitest";
import { param, row, sql, SqlBuildContext, SqlQuery } from "valnor";
import { jsonMany } from "../json-many-mssql.js";
import { Account, IAccountSelect } from "valnor/testing";

describe("json-agg-mssql tests", () => {
   test("should render select w/o alias", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const target = jsonMany(
         sql`select ${row(Account.$$)} from ${Account.as(`children`)} where ${Account.as(`children`).$parentId} = ${Account.$accountId}`,
      );
      target.build(context, {});
      console.log(context.text);
      expect(context.text).toMatchInlineSnapshot(`""query_0_result"."query_0""`);
   });

   test("should render select with alias", () => {
      const context = new SqlBuildContext();
      context.next("select");
      const target = jsonMany(
         sql`select ${row(Account.as("children").$$)} from ${Account.as(`children`)} where ${Account.as(`children`).$parentId} = ${Account.$accountId}`,
      ).as("children");
      target.build(context);
      console.log(context.text);

      expect(context.text).toMatchInlineSnapshot(`""query_0_result"."query_0" AS "children""`);
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
        "OUTER apply (
          SELECT
            coalesce(
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
                  "children"."parent_id" = "a_1"."account_id" FOR json path,
                  include_null_values
              ),
              '[]'
            ) AS "query_0"
        ) AS "query_0_result""
      `);
   });

   test("should build full query with json aggregation", () => {
      const AccountChildren = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as(`children`)}
         where ${Account.as(`children`).$parentId} = ${Account.$accountId}
         order by ${Account.as(`children`).$createdAt} desc
         offset 0 rows fetch next ${param<{ limit: number }>("limit")} rows only
      `;

      const query = sql`
         select ${row(Account.$$)},
                ${jsonMany(AccountChildren).as("children")}
         from ${Account} ${jsonMany(AccountChildren)}
      `;

      assertType<SqlQuery<{ Row: IAccountSelect & { children: string }; Params: { limit: number } }>>(query);
      expect(query.row.$children).toBeDefined();
      expect(query.params).toMatchObject({
         limit: { name: "limit" },
      });

      expect(query.params.limit).toMatchObject({ name: "limit" });

      const { text } = query.getSql({ params: { limit: 10 }, options: {} });
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
          "query_1_result"."query_1" AS "children"
        FROM
          "main"."account" AS "a_1" OUTER apply (
            SELECT
              coalesce(
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
                  OFFSET
                    0 ROWS
                  FETCH NEXT
                    ? ROWS ONLY FOR json path,
                    include_null_values
                ),
                '[]'
              ) AS "query_1"
          ) AS "query_1_result""
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
      expect(target.params).toMatchObject({
         limit: { name: "limit" },
      });
   });
});
