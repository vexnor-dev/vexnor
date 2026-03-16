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

   test("jsonOne(): select - returns correct column in result", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonOne(AccountParent).as("parent")}
         from ${Account} ${jsonOne(AccountParent)}
         where ${Account.$parentId} is not null
         limit 1
      `;
      const result = await query.getOneOptional({ db: pool });
      expect(result).toHaveProperty("parent");
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

      const result = await query.getOneOptional({ db: pool })!;
      expect(result).toBeDefined();
   });
});
