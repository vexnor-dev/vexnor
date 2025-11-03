import { describe, expect, test } from "vitest";
import { SqlQueryContext } from "../query/index.js";
import { Account } from "./models/one_sql.account-table.js";
import { trim } from "../trim.js";

describe("SqlSelectAll (*) tests", () => {
   test("select * $build should render list of columns", () => {
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      Account.$$all.$build(context);

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

   test("select * $build should render list of columns with aliased table", () => {
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      Account`inserted`.$$all.$build(context);

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

   test("returning * $build should render list of columns", () => {
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("returning");
      Account.$$all.$build(context);

      expect(context.text).toEqual(trim`
         "account"."account_id"  as "accountId",
         "account"."status",
         "account"."email",
         "account"."first_name"  as "firstName",
         "account"."last_name"   as "lastName",
         "account"."notes",
         "account"."created_at"  as "createdAt",
         "account"."modified_at" as "modifiedAt",
         "account"."parent_id"   as "parentId"`);
   });

   test("output * $build should render list of columns with aliased table", () => {
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("output");
      Account`inserted`.$$all.$build(context);

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

   test("count(*) $build should render *", () => {
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("count(");
      Account.$$all.$build(context);

      expect(context.text).toEqual(trim`*`);
   });

   test("exists (select *) $build should render *", () => {
      const context = new SqlQueryContext({ queryName: "test" });
      // Simulate the context of being inside an EXISTS clause
      context.next("exists");
      context.next("select");
      Account.$$all.$build(context);

      expect(context.text).toEqual(trim`*`);
   });
});
