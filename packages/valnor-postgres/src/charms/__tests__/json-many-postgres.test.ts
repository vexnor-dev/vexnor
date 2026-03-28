import { assertType, describe, expect, test } from "vitest";
import { JsonRow, param, row, sql, SqlBuildContext, SqlCharm, SqlParam, SqlQueryExtended } from "valnor";
import { jsonMany } from "#/charms/json-aggregation-postgres.js";
import { Account, IAccountSelect } from "valnor/testing";

describe("json-many-postgres tests", () => {
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
        "/* <query_1> */
        /* inline: true */
        LEFT JOIN LATERAL (
          SELECT
            coalesce(jsonb_agg ("query_0".*), '[]') AS "query_0_result"
          FROM
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
                "children"."parent_id" = "a_1"."account_id" /* </query_0> */
            ) AS "query_0"
        ) AS "query_0" ON TRUE
        /* </query_1> */"
      `);
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
         from ${Account} ${manyChildren}
      `;

      assertType<
         SqlQueryExtended<{
            Row: IAccountSelect & { children: JsonRow<IAccountSelect>[] };
            Params: { limit: number };
         }>
      >(query);
      expect(query.row).toMatchObject({
         $accountId: {
            type: "SqlQueryColumn",
            format: null,
            key: "accountId",
            params: null,
         },
         $createdAt: {
            type: "SqlQueryColumn",
            format: null,
            key: "createdAt",
            params: null,
         },
         $email: {
            type: "SqlQueryColumn",
            format: null,
            key: "email",
            params: null,
         },
         $firstName: {
            type: "SqlQueryColumn",
            format: null,
            key: "firstName",
            params: null,
         },
         $lastName: {
            type: "SqlQueryColumn",
            format: null,
            key: "lastName",
            params: null,
         },
         $modifiedAt: {
            type: "SqlQueryColumn",
            format: null,
            key: "modifiedAt",
            params: null,
         },
         $notes: {
            type: "SqlQueryColumn",
            format: null,
            key: "notes",
            params: null,
         },
         $parentId: {
            type: "SqlQueryColumn",
            format: null,
            key: "parentId",
            params: null,
         },
         $status: {
            type: "SqlQueryColumn",
            format: null,
            key: "status",
            params: null,
         },
         $children: {
            type: "SqlQueryColumn",
            format: null,
            key: "children",
            params: null,
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
          "query_1_result" AS "children"
        FROM
          "main"."account" AS "a_1" /* <query_2> */
          /* inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(jsonb_agg("query_1".*), '[]') AS "query_1_result"
            FROM
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
                LIMIT
                  $1
                  /* </query_1> */
              ) AS "query_1"
          ) AS "query_1" ON TRUE
          /* </query_2> */
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
