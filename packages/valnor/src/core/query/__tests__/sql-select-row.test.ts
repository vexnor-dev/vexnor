import { describe, expect, test } from "vitest";
import { InferRowSelectFromColumns, row } from "../sql-select-row.js";
import { Account } from "@test-models/valnor_test.account-table.js";
import { SqlQueryContext } from "../sql-query-context.js";
import { sql } from "../../sql.js";
import { param } from "../sql-param.js";
import { trim } from "../../utils/index.js";
import { AccountStatusUdt } from "@test-models/valnor_test-enums.js";

describe("SqlSelectRow tests", () => {
   test("InferRowSelectFromColumns<T> inference", () => {
      type Row = InferRowSelectFromColumns<[typeof Account.accountId, typeof Account.status, typeof Account.createdAt]>;
      const row: Row = {
         accountId: "",
         createdAt: new Date(),
         status: AccountStatusUdt.CREATED,
      };
      expect(row).toBeDefined();
   });

   test("$build with distinct columns", () => {
      const target = row(Account.accountId, Account.firstName, Account.lastName);
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      target.$$build(context);

      expect(context.text).toEqual(
         `"a_1"."account_id" as "accountId", "a_1"."first_name" as "firstName", "a_1"."last_name" as "lastName"`,
      );
   });

   test("$build with aliased column", () => {
      const target = row(Account.accountId, Account.firstName, Account.lastName("name"));
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      target.$$build(context);

      expect(context.text).toEqual(
         `"a_1"."account_id" as "accountId", "a_1"."first_name" as "firstName", "a_1"."last_name" as "name"`,
      );
   });

   test("$build with aliased table and column", () => {
      const target = row(Account`inserted`.accountId, Account`inserted`.firstName, Account`inserted`.lastName("name"));
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      target.$$build(context);

      expect(context.text).toEqual(
         `"inserted"."account_id" as "accountId", "inserted"."first_name" as "firstName", "inserted"."last_name" as "name"`,
      );
   });

   test("$build with table.$$all", () => {
      const target = row(Account.$all);
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      target.$$build(context);

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
      const target = row(Account`inserted`.$all);
      const context = new SqlQueryContext({ queryName: "test" });
      context.next("select");
      target.$$build(context);

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

   test("query.row is defined", () => {
      const query = sql`
         select ${row(Account.accountId, Account.status, Account.firstName)}
         from ${Account}
         where ${Account.accountId} = ${param("accountId").is<string>()}`;
      expect(query.ROW).toBeDefined();
   });

   test("query.row is not defined", () => {
      const query = sql`
         select ${(Account.accountId, Account.status, Account.firstName)}
         from ${Account}
         where ${Account.accountId} = ${param("accountId").is<string>()}`;
      expect(query.ROW).toBeFalsy();
   });

   test("query.row.[column] renders column", () => {
      const query = sql`
         select ${row(Account.accountId, Account.status, Account.firstName)}
         from ${Account}`;
      const context = new SqlQueryContext();
      context.next("where");
      query.ROW.accountId.$$build(context);
      expect(context.text).toEqual(`"query_0"."accountId"`);
   });
});
