import { beforeAll, describe, expect, test, afterAll } from "vitest";
import { info, row, SqlBuildContext } from "valnor";
import { db } from "./config.js";
import { jsonOne, Sqlite3Tokenizer, sql } from "valnor-sqlite3";
import { Account, IAccountInsert } from "./codegen/main.schema.js";

describe.sequential("jsonOne() tests", () => {
   const testAccountIds: string[] = [];

   beforeAll(async () => {
      const parentAccount = await sql`
         insert into ${Account}
            (${Account.$firstName}, ${Account.$lastName}, ${Account.$email}, ${Account.$status})
            values ('John-Parent', 'Doe-Parent', 'john.parent@example.com', 'created')
            returning ${row(Account.$$)}
      `.getOneRequired({ db });
      testAccountIds.push(parentAccount.accountId);
      expect(parentAccount.accountId).toBeDefined();

      const childrenInserts: IAccountInsert[] = [
         {
            status: "created",
            firstName: "John-Child-1",
            lastName: "Doe-Child-1",
            email: "john.child1@example.com",
            parentId: parentAccount.accountId,
         },
         {
            status: "created",
            firstName: "John-Child-2",
            lastName: "Doe-Child-2",
            email: "john.child2@example.com",
            parentId: parentAccount.accountId,
         },
      ];

      for (const child of childrenInserts) {
         const inserted = await sql`
            insert into ${Account}
               (${Account.$firstName}, ${Account.$lastName}, ${Account.$email}, ${Account.$status}, ${Account.$parentId})
               values (${child.firstName}, ${child.lastName}, ${child.email}, ${child.status}, ${child.parentId})
            returning ${row(Account.$$)}
         `.getOneRequired({ db });
         testAccountIds.push(inserted.accountId);
      }
   });

   afterAll(async () => {
      if (testAccountIds.length > 0) {
         await sql`delete from ${Account} where ${Account.$accountId} in (${testAccountIds})`.run({ db });
      }
   });

   const AccountParent = sql`
      ${info({ label: "AccountParent" })}
      select ${row(Account.$$)}
      from ${Account}
      where ${Account.$accountId} = ${Account.out.$parentId}`;

   test("jsonOne(): select", () => {
      const context = new SqlBuildContext({ tokenizer: new Sqlite3Tokenizer() });
      context.next("select");
      context.setAlias(Account.tableInfo, { alias: "_out_" });
      const jsonAccountParent = jsonOne(AccountParent);
      jsonAccountParent.build(context, {});
      expect(context.text).toMatchInlineSnapshot(`
        "(
          /* <query_0> */
          SELECT
            json_object ("AccountParent".*)
          FROM
            (
              /* <AccountParent> */
              /* label: AccountParent */
              SELECT
                "a_1"."account_id" AS "accountId",
                "a_1"."status",
                "a_1"."email",
                "a_1"."first_name" AS "firstName",
                "a_1"."last_name" AS "lastName",
                "a_1"."notes",
                "a_1"."created_at" AS "createdAt",
                "a_1"."modified_at" AS "modifiedAt",
                "a_1"."parent_id" AS "parentId"
              FROM
                "main"."account" AS "a_1"
              WHERE
                "a_1"."account_id" = "_out_"."parent_id" /* </AccountParent> */
            ) AS "AccountParent"
          LIMIT
            1 /* </query_0> */
        )"
      `);
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

      const result = await query.getOneOptional({ db }).then((z) => {
         if (!z) return undefined;
         return {
            ...z,
            parent: z.parent ? JSON.parse(z.parent as any) : null,
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
         select ${row(Account.$$)}, ${oneChild.as("child")}
         from ${Account}, children
         where children.parent_id = ${Account.$accountId}
           and children.children_count > 1
         limit 1
      `;

      const result = await query.getOneOptional({ db });
      expect(result).toBeDefined();
   });
});
