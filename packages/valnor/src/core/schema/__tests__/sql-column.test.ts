import { Account } from "@test-models/valnor_test.account-table.js";
import { describe, expect, test } from "vitest";
import { Sql } from "#/core/sql-base.js";
import { SqlTableColumn } from "#/core/schema/sql-table-column.js";

describe("SqlColumn tests", () => {
   test("SqlColumn should be defined", () => {
      expect(Account.$accountId).toBeDefined();
   });

   test("SqlColumn inherits Sql", () => {
      expect(Account.$accountId).instanceof(Sql);
   });

   test("SqlColumn inherits SqlColumn", () => {
      expect(Account.$accountId).instanceof(SqlTableColumn);
   });

   test("SqlColumn to be defined", () => {
      expect(Account.$accountId).toBeDefined();
   });

   test("SqlColumn to match definition", () => {
      expect({ ...Account.$accountId }).toMatchObject({
         columnName: "account_id",
         key: "accountId",
         tableInfo: {
            name: "account",
            schema: "main",
         },
      });
   });

   test("SqlColumn alias should return new SqlColumn instance", () => {
      expect(Account.$firstName.key).toEqual("firstName");
      expect({ ...Account.$firstName.as("parentFirstName") }).toMatchObject({
         columnName: "first_name",
         key: "parentFirstName",
         tableInfo: {
            schema: "main",
            name: "account",
         },
      });
   });

   test("SqlColumn alias from SqlTable alias should return new SqlColumn instance", () => {
      expect({ ...Account.as`parent`.$firstName.as("parentFirstName") }).toMatchObject({
         columnName: "first_name",
         key: "parentFirstName",
         tableInfo: {
            schema: "main",
            name: "account",
            alias: "parent",
         },
      });
   });
});
