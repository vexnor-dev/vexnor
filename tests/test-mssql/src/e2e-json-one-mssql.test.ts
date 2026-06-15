import { beforeAll, describe, expect, test } from "vitest";
import { info, row, SqlBuildContext } from "vexnor";
import { pool } from "./mssql-pool.js";
import { jsonOne, MssqlTokenizer, sql } from "@vexnor/mssql";
import { Account } from "./codegen/vexnor_dev.schema.js";
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

   test("jsonOne(): select - returns correct column in result", async () => {
      const parentJsonOne = jsonOne(AccountParent);
      const query = sql`
         select top 1 ${row(Account.$$)}, ${parentJsonOne.as("parent")}
         from ${Account} ${parentJsonOne}
         where ${Account.$parentId} is not null
      `;
      const result = await query.any({ db: pool.request() });
      expect(result).toHaveProperty("parent");
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
      const query = sql`
         select top 1 ${row(Account.$$)}, ${jsonOne(AccountParent).as("parent")}
         from ${Account} ${jsonOne(AccountParent)}
         where ${Account.$parentId} is not null
      `;

      const result = await query.any({ db: pool.request() });

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

      const result = await query.any({ db: pool.request() })!;
      expect(result).toBeDefined();
   });
});
