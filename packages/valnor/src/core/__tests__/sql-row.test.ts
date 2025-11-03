import { describe, expect, test } from "vitest";
import { row, SqlQueryContext } from "../query/index.js";
import { Account } from "./models/one_sql.account-table.js";
import { trim } from "../trim.js";

describe("SqlRow tests", () => {
   test("SqlRow $build with distinct columns", () => {
      const target = row(Account.accountId, Account.firstName, Account.lastName);
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      target.$build(context);

      expect(context.text).toEqual(
         `"a_1"."account_id" as "accountId", "a_1"."first_name" as "firstName", "a_1"."last_name" as "lastName"`,
      );
   });

   test("SqlRow $build with aliased column", () => {
      const target = row(Account.accountId, Account.firstName, Account.lastName`name`);
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      target.$build(context);

      expect(context.text).toEqual(
         `"a_1"."account_id" as "accountId", "a_1"."first_name" as "firstName", "a_1"."last_name" as "name"`,
      );
   });

   test("SqlRow $build with aliased table and column", () => {
      const target = row(Account`inserted`.accountId, Account`inserted`.firstName, Account`inserted`.lastName`name`);
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      target.$build(context);

      expect(context.text).toEqual(
         `"inserted"."account_id" as "accountId", "inserted"."first_name" as "firstName", "inserted"."last_name" as "name"`,
      );
   });

   test("SqlRow $build with table.$$all", () => {
      const target = row(Account.$$all);
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      target.$build(context);

      expect(context.text).toEqual(trim`
         "a_1"."account_id"  as "accountId",
         "a_1"."status",
         "a_1"."email",
         "a_1"."first_name"  as "firstName",
         "a_1"."last_name"   as "lastName",
         "a_1"."notes",
         "a_1"."created_at"  as "createdAt",
         "a_1"."modified_at" as "modifiedAt",
         "a_1"."parent_id"   as "parentId"`);
   });

   test("SqlRow $build with aliased table.$$all", () => {
      const target = row(Account`inserted`.$$all);
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      target.$build(context);

      expect(context.text).toEqual(trim`
         "inserted"."account_id"  as "accountId",
         "inserted"."status",
         "inserted"."email",
         "inserted"."first_name"  as "firstName",
         "inserted"."last_name"   as "lastName",
         "inserted"."notes",
         "inserted"."created_at"  as "createdAt",
         "inserted"."modified_at" as "modifiedAt",
         "inserted"."parent_id"   as "parentId"`);
   });
});
