import { beforeAll, describe, expect, test } from "vitest";
import { info, row, SqlBuildContext } from "valnor";
import { Account, AccountStatusUdt } from "./codegen/valnor_test.schema.js";
import { jsonOne, PostgresTokenizer, sql } from "valnor-postgres";
import { pool } from "./postgres-pool.js";

describe.sequential("jsonOne() tests", () => {
   const TAG = "json-one-test";

   beforeAll(async () => {
      const parentAccount = await sql`
         insert into ${Account}
            ${Account.insertColsVals({
               status: AccountStatusUdt.CREATED,
               firstName: "John-0-json-one",
               lastName: "Doe-0-json-one",
               email: `john.doe-${TAG}@example.com`,
            })}
            returning ${row(Account.$$)}
      `.getOneRequired({ db: pool });
      expect(parentAccount.parentId).toBeDefined();

      const childrenAccounts = await sql`
         insert into ${Account}
            ${Account.insertColsVals(
               {
                  status: AccountStatusUdt.CREATED,
                  firstName: "John-1-json-one",
                  lastName: "Doe-1-json-one",
                  email: `john.doe-1-${TAG}@example.com`,
                  parentId: parentAccount.accountId,
               },
               {
                  status: AccountStatusUdt.CREATED,
                  firstName: "John-2-json-one",
                  lastName: "Doe-2-json-one",
                  email: `john.doe-2-${TAG}@example.com`,
                  parentId: parentAccount.accountId,
               },
            )}
            returning ${row(Account.$$)}
      `.getAll({ db: pool });
      expect(childrenAccounts).toHaveLength(2);
   });

   const AccountParent = sql`
      ${info({ label: "AccountParent" })}
      select ${row(Account.$$)}
      from ${Account}
      where ${Account.$accountId} = ${Account.out.$parentId}
      limit 1`;

   test("jsonOne(): select", () => {
      const context = new SqlBuildContext({ tokenizer: new PostgresTokenizer("test") });
      context.next("select");
      const jsonAccountParent = jsonOne(AccountParent);
      jsonAccountParent.build(context, {});
      expect(context.tokens[0]).toMatchInlineSnapshot(`
        {
          "type": "text",
          "value": ""AccountParent_result"",
        }
      `);
   });

   const INVALID_KEYWORDS_FOR_JSON_ONE = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_ONE)("jsonOne().build() throws error for keyword: %s", (keyword) => {
      const context = new SqlBuildContext({ tokenizer: new PostgresTokenizer("test") });
      context.next(keyword);
      expect(() => jsonOne(AccountParent).build(context, {})).toThrow(
         "Cannot use JsonAggregationPostgres with SQL keyword:",
      );
   });

   test("jsonOne() E2E: fetch child account with parent info", async () => {
      const AccountParent = sql`
         select ${row(Account.as("parent").$$)}
         from ${Account.as("parent")}
         where ${Account.as("parent").$accountId} = ${Account.out.$parentId}
      `;

      const query = sql`
         select ${row(Account.$$)}, ${jsonOne(AccountParent).as("parent")}
         from ${Account} ${jsonOne(AccountParent)}
         where ${Account.$parentId} is not null
         limit 1
      `;

      const result = await query.getOneOptional({ db: pool });
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
         with children as (select ${Account.$parentId.as("parent_id")}, count(${Account}) as children_count
                           from ${Account}
                           where ${Account.$parentId} is not null
                           group by ${Account.$parentId})
         select ${row(Account.$$)}, ${oneChild.as("parent")}
         from ${Account} ${jsonOne(AccountChildren)}
                 join children on children.parent_id = ${Account.$accountId}
         where children.children_count > 1
         limit 1
      `;

      expect(query.query.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH
          children AS (
            SELECT
              "a_1"."parent_id",
              count("a_1") AS children_count
            FROM
              "valnor_test"."account" AS "a_1"
            WHERE
              "a_1"."parent_id" IS NOT NULL
            GROUP BY
              "a_1"."parent_id"
          )
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
          "query_1_result" AS "parent"
        FROM
          "valnor_test"."account" AS "a_1"
          /* <query_2> */
          /* --inline: true */
          LEFT JOIN LATERAL (
            SELECT
              coalesce(to_jsonb ("query_1".*), NULL) AS "query_1_result"
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
                  "valnor_test"."account" AS "children"
                WHERE
                  "children"."parent_id" = "a_1"."account_id"
                  /* </query_1> */
              ) AS "query_1"
          ) AS "query_1" ON TRUE
          /* </query_2> */
          JOIN children ON children.parent_id = "a_1"."account_id"
        WHERE
          children.children_count > 1
        LIMIT
          1
          /* </query_0> */"
      `);

      const result = await query.getOneOptional({ db: pool })!;
      expect(result).toBeDefined();
   });
});
