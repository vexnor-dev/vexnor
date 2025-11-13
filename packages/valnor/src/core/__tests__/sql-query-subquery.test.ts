import { describe, expect, test } from "vitest";
import { Account, AccountStatusUdt } from "./models/valnor_test.schema.js";
import { ExtractParamsFromQuery, sql } from "../sql.js";
import { info } from "../charms/index.js";
import { param, row } from "../query/index.js";

describe("sql subqueries tests", () => {
   test("sub-query CTE/with", () => {
      const AccountsCreated = sql`
         ${info({ label: "AccountsCreated" })}
            select ${row(Account.$$)}
            from ${Account}
            where ${Account.$status} = ${AccountStatusUdt.CREATED}
         `;

      const AccountsOld = sql`
         ${info({ label: "AccountsOld" })}
         select ${row(AccountsCreated.$$)}
         select ${row(Account.$$)}
         where ${Account.$createdAt} = ${Date.parse("2020-01-01")}
      `;

      const query = sql`
         with AccountsCreated as (${AccountsCreated}),
              AccountsOlds as
                    (${AccountsOld})
         select ${row(Account.$$)}
         from ${Account}
                 join ${AccountsCreated} on ${Account.$accountId} = ${AccountsCreated.$accountId}
            join ${AccountsOld} on ${Account.$accountId} = ${AccountsOld.$accountId}         
      `;

      type Params = ExtractParamsFromQuery<typeof query>;
      const params: Params = undefined;
      console.log(query.getSql({}));
      expect(params).toBeUndefined();
   });

   test("sub-query from", () => {
      const AccountsWithEmail = sql`
         ${info({ label: "AccountsWithEmail" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param("email").is<string>()}`;

      const query = sql`
         select ${row(AccountsWithEmail.$$)}
         from ${AccountsWithEmail}
         where ${AccountsWithEmail.$firstName} = ${param("firstName").is<string>()}`;

      query.buildCache({});
      expect(query.getValues({ params: { firstName: "John", email: "test@example.com" } })).toEqual([
         "test@example.com",
         "John",
      ]);
      expect(query.getSql({ params: { firstName: "John", email: "test@example.com" } }))
         .toEqualQuery(` select "AccountsWithEmail".*
                         from (/* --label: AccountsWithEmail */ select "a_1"."account_id"  as "accountId",
                                                                       "a_1"."status",
                                                                       "a_1"."email",
                                                                       "a_1"."first_name"  as "firstName",
                                                                       "a_1"."last_name"   as "lastName",
                                                                       "a_1"."notes",
                                                                       "a_1"."created_at"  as "createdAt",
                                                                       "a_1"."modified_at" as "modifiedAt",
                                                                       "a_1"."parent_id"   as "parentId"
                                                                from "valnor_test"."account" as "a_1"
                                                                where "a_1"."email" = ?) as "AccountsWithEmail"
                         where "AccountsWithEmail"."firstName" = ?`);
   });

   test("sub-query join", () => {
      const AccountsWithEmail = sql`
         ${info({ label: "AccountsWithEmail" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param("email").is<string>()}
      `;

      const query = sql`
         select ${row(Account.$accountId, Account.$status, Account.$email, Account.$firstName, Account.$lastName)}
         from ${Account}
                 join ${AccountsWithEmail} on ${Account.$accountId} = ${AccountsWithEmail.$accountId}
         where ${Account.$firstName} = ${param("firstName").is<string>()}`;

      expect(query.getValues({ params: { firstName: "John", email: "test@example.com" } })).toEqual([
         "test@example.com",
         "John",
      ]);
      expect(query.getSql({ params: { firstName: "John", email: "test@example.com" } }))
         .toEqualQuery(`select "a_1"."account_id" as "accountId",
                               "a_1"."status",
                               "a_1"."email",
                               "a_1"."first_name" as "firstName",
                               "a_1"."last_name"  as "lastName"
                        from "valnor_test"."account" as "a_1"
                                join (
                           /* --label: AccountsWithEmail */
                           select "a_1"."account_id"  as "accountId",
                                  "a_1"."status",
                                  "a_1"."email",
                                  "a_1"."first_name"  as "firstName",
                                  "a_1"."last_name"   as "lastName",
                                  "a_1"."notes",
                                  "a_1"."created_at"  as "createdAt",
                                  "a_1"."modified_at" as "modifiedAt",
                                  "a_1"."parent_id"   as "parentId"
                           from "valnor_test"."account" as "a_1"
                           where "a_1"."email" = ?) as "AccountsWithEmail"
                                     on "a_1"."account_id" = "AccountsWithEmail"."accountId"
                        where "a_1"."first_name" = ?`);
   });

   test("self join", () => {
      const query = sql`
         select ${row(Account.$$, Account`parent`.$firstName("parentFirstName"), Account`parent`.$lastName("parentLastName"))}
         from ${Account}
                 join ${Account`parent`} on ${Account`parent`.$accountId} = ${Account.$parentId}
         where ${Account.$firstName} = ${param("firstName").is<string>()}`;

      expect(query.getSql({ params: { firstName: "John" } })).toEqualQuery(
         `select 
                     "a_1"."account_id"  as "accountId",
                     "a_1"."status",
                     "a_1"."email",
                     "a_1"."first_name"  as "firstName",
                     "a_1"."last_name"   as "lastName",
                     "a_1"."notes",
                     "a_1"."created_at"  as "createdAt",
                     "a_1"."modified_at" as "modifiedAt",
                     "a_1"."parent_id"   as "parentId",
                     "parent"."first_name"  as "parentFirstName",
                     "parent"."last_name"   as "parentLastName"
              from "valnor_test"."account" as "a_1"
                      join "valnor_test"."account" as "parent" on "parent"."account_id" = "a_1"."parent_id"
              where "a_1"."first_name" = ?`,
      );
   });
});
