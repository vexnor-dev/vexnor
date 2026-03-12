import { beforeAll, describe, expect, test } from "vitest";
import { info, row, SqlBuildContext } from "valnor";
import { pool } from "./mssql-pool.js";
import { jsonOne, MssqlTokenizer, sql } from "valnor-mssql";
import { Account } from "./codegen/valnor_test.schema.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("jsonOne() tests", (ctx) => {
   const dataManager = new TestDataManager(ctx, {
      ACCOUNT_ROOT_COUNT: 1,
      ACCOUNT_CHILD_FACTOR: 2,
   });

   beforeAll(async () => {
      await dataManager.initRootAccounts(pool);
      await dataManager.initChildAccounts(pool);
   });
   const AccountParent = sql`
      ${info({ label: "AccountParent" })}
      select ${row(Account.$$)}
      from ${Account}
      where ${Account.$accountId} = ${Account.out.$parentId}`;

   test("jsonOne(): select", () => {
      const context = new SqlBuildContext({ tokenizer: new MssqlTokenizer() });
      context.next("select");
      const jsonAccountParent = jsonOne(AccountParent);
      jsonAccountParent.build(context, {});
      expect(context.tokens[0]).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": ""query_0_result"."query_0"",
        }
      `);
   });

   const INVALID_KEYWORDS_FOR_JSON_ONE = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_ONE)("jsonOne().build() throws error for keyword: %s", (keyword) => {
      const context = new SqlBuildContext({ tokenizer: new MssqlTokenizer() });
      context.next(keyword);
      expect(() => jsonOne(AccountParent).build(context, {})).toThrow(
         "Cannot use JsonAggregationMssql with SQL keyword:",
      );
   });

   test("jsonOne() E2E: fetch account with parent info", async () => {
      const parentJsonOne = jsonOne(AccountParent);
      const query = sql`
         select top 1 ${row(Account.$$)}, ${parentJsonOne.as("parent")}
         from ${Account} ${parentJsonOne}
         where ${Account.$parentId} is not null
      `;

      const result = await query.getOneOptional({ db: pool.request() }).then((z) => {
         return {
            ...z,
            parent: z?.parent ? JSON.parse(z?.parent) : null,
         };
      });

      if (result) {
         expect(result.parent).toBeDefined();
         expect(result.parent?.accountId).toBe(result.parentId);
      }
   });

   test("jsonOne() E2E: returns first row when subquery has multiple results", async () => {
      const AccountChildren = sql`
         select ${row(Account.as("children").$$)}
         from ${Account.as("children")}
         where ${Account.as("children").$parentId} = ${Account.out.$accountId}
      `;

      const oneChild = jsonOne(AccountChildren);
      const query = sql`
         with children as (select ${Account.$parentId.as("parent_id")}, count(${Account.$accountId}) as children_count
                           from ${Account}
                           where ${Account.$parentId} is not null
                           group by ${Account.$parentId})
         select top 1 ${row(Account.$$)}, ${oneChild.as("parent")}
         from ${Account} ${oneChild}
                 join children on children.parent_id = ${Account.$accountId}
         where children.children_count > 1
      `;

      expect(query.query.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH
          children AS (
            SELECT
              "a_1"."parent_id",
              count("a_1"."account_id") AS children_count
            FROM
              "valnor_test"."account" AS "a_1"
            WHERE
              "a_1"."parent_id" IS NOT NULL
            GROUP BY
              "a_1"."parent_id"
          )
        SELECT
          TOP 1 "a_1"."account_id" AS "accountId",
          "a_1"."parent_id" AS "parentId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "query_1_result"."query_1" AS "parent"
        FROM
          "valnor_test"."account" AS "a_1" /* <query_3> */
          OUTER APPLY (
            SELECT
              coalesce(
                (
                  /* <query_1> */
                  SELECT
                    TOP 1 "query_2".*
                  FROM
                    (
                      /* <query_2> */
                      SELECT
                        "children"."account_id" AS "accountId",
                        "children"."parent_id" AS "parentId",
                        "children"."status",
                        "children"."email",
                        "children"."first_name" AS "firstName",
                        "children"."last_name" AS "lastName",
                        "children"."notes",
                        "children"."created_at" AS "createdAt",
                        "children"."modified_at" AS "modifiedAt"
                      FROM
                        "valnor_test"."account" AS "children"
                      WHERE
                        "children"."parent_id" = "a_1"."account_id"
                        /* </query_2> */
                    ) AS "query_2" /* </query_1> */
                  FOR JSON
                    path,
                    WITHOUT_ARRAY_WRAPPER,
                    include_null_values
                ),
                NULL
              ) AS "query_1"
          ) AS "query_1_result" /* </query_3> */
          JOIN children ON children.parent_id = "a_1"."account_id"
        WHERE
          children.children_count > 1
          /* </query_0> */"
      `);

      const result = await query.getOneOptional({ db: pool.request() })!;
      expect(result).toBeDefined();
   });
});
