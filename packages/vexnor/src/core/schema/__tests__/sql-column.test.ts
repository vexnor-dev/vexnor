import { Account } from "@test-models/vexnor_dev.account-table.js";
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
      expect(Account.$accountId).toMatchInlineSnapshot(`
        SqlTableColumn {
          "columnName": "account_id",
          "format": null,
          "hashIdLazy": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
          "id": "SqlTableColumn#1(account.account_id as accountId)",
          "jsonType": null,
          "key": "accountId",
          "tableInfo": {
            "alias": null,
            "name": "account",
            "out": false,
            "schema": "main",
          },
          "tag": null,
          "type": "SqlTableColumn",
        }
      `);
   });

   test("SqlColumn alias should return new SqlColumn instance", () => {
      expect(Account.$firstName.as("parentFirstName")).toMatchInlineSnapshot(`
        SqlTableColumn {
          "columnName": "first_name",
          "format": null,
          "hashIdLazy": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
          "id": "SqlTableColumn#1(account.first_name as parentFirstName)",
          "jsonType": null,
          "key": "parentFirstName",
          "tableInfo": {
            "alias": null,
            "name": "account",
            "out": false,
            "schema": "main",
          },
          "tag": null,
          "type": "SqlTableColumn",
        }
      `);
   });

   test("SqlColumn alias from SqlTable alias should return new SqlColumn instance", () => {
      expect(Account.as`parent`.$firstName.as("parentFirstName")).toMatchInlineSnapshot(`
        SqlTableColumn {
          "columnName": "first_name",
          "format": null,
          "hashIdLazy": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
          "id": "SqlTableColumn#10(parent.first_name as parentFirstName)",
          "jsonType": null,
          "key": "parentFirstName",
          "tableInfo": {
            "alias": "parent",
            "name": "account",
            "out": false,
            "schema": "main",
          },
          "tag": null,
          "type": "SqlTableColumn",
        }
      `);
   });
});
