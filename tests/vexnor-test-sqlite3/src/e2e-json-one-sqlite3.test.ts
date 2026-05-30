import { beforeAll, describe, expect, test } from "vitest";
import { info, row, SqlBuildContext } from "vexnor";
import { db } from "./config.js";
import { jsonOne, sql, Sqlite3Tokenizer } from "vexnor-sqlite3";
import { Account, IAccountInsert } from "./codegen/main.schema.js";
import { getTag } from "./tags.js";

describe.sequential("jsonOne() tests", (ctx) => {
   const TAG = getTag(ctx);

   beforeAll(async () => {
      const parentAccount = await sql`
         insert into ${Account}
            (${Account.$firstName}, ${Account.$lastName}, ${Account.$email}, ${Account.$status})
            values ('John-Parent', 'Doe-Parent', ${`john.parent-${TAG}@example.com`}, 'created')
            returning ${row(Account.$$)}
      `.one({ db });
      expect(parentAccount.accountId).toBeDefined();

      const childrenInserts: IAccountInsert[] = [
         {
            status: "created",
            firstName: "John-Child-1",
            lastName: "Doe-Child-1",
            email: `john.child1-${TAG}@example.com`,
            parentId: parentAccount.accountId,
         },
         {
            status: "created",
            firstName: "John-Child-2",
            lastName: "Doe-Child-2",
            email: `john.child2-${TAG}@example.com`,
            parentId: parentAccount.accountId,
         },
      ];

      for (const child of childrenInserts) {
         const inserted = await sql`
            insert into ${Account}
               (${Account.$firstName}, ${Account.$lastName}, ${Account.$email}, ${Account.$status}, ${Account.$parentId})
               values (${child.firstName}, ${child.lastName}, ${child.email}, ${child.status}, ${child.parentId})
            returning ${row(Account.$$)}
         `.one({ db });
         expect(inserted.accountId).toBeDefined();
      }
   });

   const AccountParent = sql`
      ${info({ label: "AccountParent" })}
      select ${row(Account.$$)}
      from ${Account}
      where ${Account.$accountId} = ${Account.out.$parentId}`;

   test("jsonOne(): select - returns correct column in result", async () => {
      const query = sql`
         select ${row(Account.$$)}, ${jsonOne(AccountParent).as("parent")}
         from ${Account}
         where ${Account.$parentId} is not null
         limit 1
      `;
      const result = await query.any({ db });
      expect(result).toHaveProperty("parent");
   });

   const INVALID_KEYWORDS_FOR_JSON_ONE = ["where", "group by", "order by", "update", "delete from"];
   test.each(INVALID_KEYWORDS_FOR_JSON_ONE)("jsonOne().build() throws error for keyword: %s", (keyword) => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer() });
      context.next(keyword);
      expect(() => jsonOne(AccountParent).build(context, {})).toThrow(
         `Cannot use json aggregation with SQL keyword '${keyword}'`,
      );
   });

   test("jsonOne() E2E: fetch account with parent info", async () => {
      const parentJsonOne = jsonOne(AccountParent);
      const query = sql`
         select ${row(Account.$$)}, ${parentJsonOne.as("parent")}
         from ${Account}
         where ${Account.$parentId} is not null
         limit 1
      `;

      const result = await query.any({ db });

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
         select ${row(Account.$$)}, ${oneChild.as("child")}
         from ${Account}, children
         where children.parent_id = ${Account.$accountId}
           and children.children_count > 1
         limit 1
      `;

      const result = await query.any({ db });
      expect(result).toBeDefined();
   });
});
