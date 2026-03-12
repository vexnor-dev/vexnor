import { assertType, describe, expect, test } from "vitest";
import { param, row, sql, SqlBuildContext, SqlQuery } from "valnor";
import { jsonMany } from "#/charms/json-aggregation-mssql.js";
import { Account, IAccountSelect } from "valnor/testing";
import { defaultQueryOptions } from "#/default-query-options.js";

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
        "/* <query_1> */ OUTER apply (
          SELECT
            coalesce(
              (
                /* <query_0> */
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
                  "children"."parent_id" = "a_1"."account_id" /* </query_0> */ FOR json path,
                  include_null_values
              ),
              '[]'
            ) AS "query_0"
        ) AS "query_0_result" /* </query_1> */"
      `);
   });

   test("should build full query with json aggregation", () => {
      const AccountChildren = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$parentId} = ${Account.out.$accountId}
         order by ${Account.$createdAt} desc
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

      const { text } = query.getSql({ params: { limit: 10 }, options: defaultQueryOptions });
      console.log(text);
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
          "query_1_result"."query_1" AS "children"
        FROM
          "main"."account" AS "a_1" /* <query_2> */
          OUTER APPLY (
            SELECT
              coalesce(
                (
                  /* <query_1> */
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
                  OFFSET
                    0 rows
                  FETCH NEXT
                    @param_0 rows only
                    /* </query_1> */
                  FOR JSON
                    path,
                    include_null_values
                ),
                '[]'
              ) AS "query_1"
          ) AS "query_1_result" /* </query_2> */
          /* </query_0> */"
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
