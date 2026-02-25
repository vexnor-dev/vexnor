import { beforeAll, describe, expect, test } from "vitest";
import { info, row, SqlBuildContext } from "valnor";
import { pool } from "./mssql-pool.js";
import { jsonOne, MssqlTokenizer, sql } from "valnor-mssql";
import { Account, IAccountInsert } from "./codegen/valnor_test.schema.js";
import { getTag } from "./config.js";

describe.sequential("jsonOne() tests", (ctx) => {
   const TAG = getTag(ctx);

   beforeAll(async () => {
      const parentInsert: IAccountInsert = {
         status: "created",
         firstName: `John-0-${TAG}}`,
         lastName: `Doe-0-${TAG}}`,
         email: `john.doe-${TAG}@example.com`,
      };
      const parentAccount = await sql`
         insert into ${Account}
            ${Account.insertCols(parentInsert)}
            output ${row(Account.as`inserted`.$$)}
            ${Account.insertVals(parentInsert)}
      `.getOneRequired({ db: pool.request() });
      expect(parentAccount.accountId).toBeDefined();

      const childrenInserts: IAccountInsert[] = [
         {
            status: "created",
            firstName: `John-1-${TAG}`,
            lastName: `Doe-1-${TAG}`,
            email: `john.doe-1-${TAG}@example.com`,
            parentId: parentAccount.accountId,
         },
         {
            status: "created",
            firstName: `John-2-${TAG}`,
            lastName: `Doe-2-${TAG}`,
            email: `john.doe-2-${TAG}@example.com`,
            parentId: parentAccount.accountId,
         },
      ];
      const insertChildren = sql`
         insert into ${Account}
            ${Account.insertCols(...childrenInserts)}
            output ${row(Account.as`inserted`.$$)}
            ${Account.insertVals(...childrenInserts)}
      `;
      const x = insertChildren.getSql({});
      console.log("jsonOne: insert children", x.values, "\n", x.text);
      const childrenInserted = await insertChildren.getAll({ db: pool.request() });
      expect(childrenInserted).toHaveLength(2);

      console.log("children", childrenInserted);
   });

   const AccountParent = sql`
      ${info({ label: "AccountParent" })}
      select ${row(Account.$$)}
      from ${Account}
      where ${Account.$accountId} = ${Account.out.$parentId}`;

   test("jsonOne(): select", () => {
      const context = new SqlBuildContext({ tokenizer: new MssqlTokenizer("test") });
      context.next("select");
      const jsonAccountParent = jsonOne(AccountParent);
      jsonAccountParent.build(context, {});
      expect(context.tokens[0]).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": ""AccountParent_result"."AccountParent"",
        }
      `);
   });

   const INVALID_KEYWORDS_FOR_JSON_ONE = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_ONE)("jsonOne().build() throws error for keyword: %s", (keyword) => {
      const context = new SqlBuildContext({ tokenizer: new MssqlTokenizer("test") });
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
         from ${Account} ${jsonOne(AccountChildren)}
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
          top 1 "a_1"."account_id" AS "accountId",
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
          "valnor_test"."account" AS "a_1"
          /* <query_2> */
          OUTER apply (
            SELECT
              coalesce(
                (
                  /* <query_3> */
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
                    /* </query_3> */
                    FOR json path,
                    WITHOUT_ARRAY_WRAPPER,
                    include_null_values
                ),
                '[]'
              ) AS "query_1"
          ) AS "query_1_result"
          /* </query_2> */
          JOIN children ON children.parent_id = "a_1"."account_id"
        WHERE
          children.children_count > 1
          /* </query_0> */"
      `);

      const result = await query.getOneOptional({ db: pool.request() })!;
      expect(result).toBeDefined();
   });
});
