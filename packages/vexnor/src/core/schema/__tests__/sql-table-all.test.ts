import { describe, expect, test } from "vitest";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { trim } from "#/core/utils/trim.js";
import { SqlTableAll } from "#/core/charms/sql-table-all.js";
import { SqlTableColumn } from "#/core/schema/sql-table-column.js";

describe("SqlTableAll (*) tests", () => {
   test("new value should be defined", () => {
      const all = new SqlTableAll<{ accountId: string; name: string }>({
         $accountId: new SqlTableColumn<{ Key: "accountId"; Type: string }>({
            key: "accountId",
            columnName: "account_id",
            tableInfo: { name: "a_1" },
         }),
         $name: new SqlTableColumn<{ Key: "name"; Type: string }>({
            key: "name",
            columnName: "name",
            tableInfo: { name: "a_1" },
         }),
      });
      expect(all).toBeDefined();
   });

   test("select * $build should render list of columns", () => {
      const context = new SqlBuildContext();
      context.next("select");
      Account.$$.build(context);

      expect(context.text).toMatchInlineSnapshot(`
        ""a_1"."account_id" AS "accountId",
        "a_1"."status",
        "a_1"."email",
        "a_1"."first_name" AS "firstName",
        "a_1"."last_name" AS "lastName",
        "a_1"."notes",
        "a_1"."created_at" AS "createdAt",
        "a_1"."modified_at" AS "modifiedAt",
        "a_1"."parent_id" AS "parentId""
      `);
   });

   test("select * $build should render list of columns with aliased table", () => {
      const context = new SqlBuildContext();
      context.next("select");
      Account.as`inserted`.$$.build(context);

      expect(context.text).toMatchInlineSnapshot(`
        ""inserted"."account_id" AS "accountId",
        "inserted"."status",
        "inserted"."email",
        "inserted"."first_name" AS "firstName",
        "inserted"."last_name" AS "lastName",
        "inserted"."notes",
        "inserted"."created_at" AS "createdAt",
        "inserted"."modified_at" AS "modifiedAt",
        "inserted"."parent_id" AS "parentId""
      `);
   });

   test("returning * $build should render list of columns", () => {
      const context = new SqlBuildContext();
      context.next("returning");
      Account.$$.build(context);

      expect(context.text).toMatchInlineSnapshot(`
        ""account"."account_id" AS "accountId",
        "account"."status",
        "account"."email",
        "account"."first_name" AS "firstName",
        "account"."last_name" AS "lastName",
        "account"."notes",
        "account"."created_at" AS "createdAt",
        "account"."modified_at" AS "modifiedAt",
        "account"."parent_id" AS "parentId""
      `);
   });

   test("output * $build should render list of columns with aliased table", () => {
      const context = new SqlBuildContext();
      context.next("output");
      Account.as`inserted`.$$.build(context);

      expect(context.text).toMatchInlineSnapshot(`
        ""inserted"."account_id" AS "accountId",
        "inserted"."status",
        "inserted"."email",
        "inserted"."first_name" AS "firstName",
        "inserted"."last_name" AS "lastName",
        "inserted"."notes",
        "inserted"."created_at" AS "createdAt",
        "inserted"."modified_at" AS "modifiedAt",
        "inserted"."parent_id" AS "parentId""
      `);
   });

   test("count(*) $build should render *", () => {
      const context = new SqlBuildContext();
      context.next("count(");
      Account.$$.build(context);

      expect(context.text).toEqual(trim`*`);
   });

   test("exists (select *) $build should render *", () => {
      const context = new SqlBuildContext();
      // Simulate the context of being inside an EXISTS clause
      context.next("exists");
      context.next("select");
      Account.$$.build(context);

      expect(context.text).toEqual(trim`*`);
   });
});
