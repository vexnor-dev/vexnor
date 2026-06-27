import { describe, expect, test } from "vitest";
import { SqlTable, newSqlTable } from "#src/core/schema/sql-table.js";
import { SqlTableColumn } from "#src/core/schema/sql-table-column.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Sql } from "#src/core/sql-base.js";

describe("SqlTable tests", () => {
   test("SqlTable inherits SqlBase", () => {
      expect(Account).instanceof(SqlTable);
      expect(Account).instanceof(Sql);
   });

   test("SqlTable should include expected columns", () => {
      expect(Account.$accountId).instanceof(SqlTableColumn);
      expect(Account.$status).instanceof(SqlTableColumn);
      expect(Account.$email).instanceof(SqlTableColumn);
   });

   test("Account table", () => {
      expect(Account).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "hashId": "SqlTableColumn#(account.account_id as accountId)",
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
          },
          "$createdAt": SqlTableColumn {
            "columnName": "created_at",
            "format": null,
            "hashId": "SqlTableColumn#(account.created_at as createdAt)",
            "id": "SqlTableColumn#7(account.created_at as createdAt)",
            "jsonType": "Date",
            "key": "createdAt",
            "tableInfo": {
              "alias": null,
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$email": SqlTableColumn {
            "columnName": "email",
            "format": null,
            "hashId": "SqlTableColumn#(account.email)",
            "id": "SqlTableColumn#3(account.email)",
            "jsonType": null,
            "key": "email",
            "tableInfo": {
              "alias": null,
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$firstName": SqlTableColumn {
            "columnName": "first_name",
            "format": null,
            "hashId": "SqlTableColumn#(account.first_name as firstName)",
            "id": "SqlTableColumn#4(account.first_name as firstName)",
            "jsonType": null,
            "key": "firstName",
            "tableInfo": {
              "alias": null,
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$lastName": SqlTableColumn {
            "columnName": "last_name",
            "format": null,
            "hashId": "SqlTableColumn#(account.last_name as lastName)",
            "id": "SqlTableColumn#5(account.last_name as lastName)",
            "jsonType": null,
            "key": "lastName",
            "tableInfo": {
              "alias": null,
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$modifiedAt": SqlTableColumn {
            "columnName": "modified_at",
            "format": null,
            "hashId": "SqlTableColumn#(account.modified_at as modifiedAt)",
            "id": "SqlTableColumn#8(account.modified_at as modifiedAt)",
            "jsonType": "Date",
            "key": "modifiedAt",
            "tableInfo": {
              "alias": null,
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$notes": SqlTableColumn {
            "columnName": "notes",
            "format": null,
            "hashId": "SqlTableColumn#(account.notes)",
            "id": "SqlTableColumn#6(account.notes)",
            "jsonType": null,
            "key": "notes",
            "tableInfo": {
              "alias": null,
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$parentId": SqlTableColumn {
            "columnName": "parent_id",
            "format": null,
            "hashId": "SqlTableColumn#(account.parent_id as parentId)",
            "id": "SqlTableColumn#9(account.parent_id as parentId)",
            "jsonType": null,
            "key": "parentId",
            "tableInfo": {
              "alias": null,
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$status": SqlTableColumn {
            "columnName": "status",
            "format": null,
            "hashId": "SqlTableColumn#(account.status)",
            "id": "SqlTableColumn#2(account.status)",
            "jsonType": null,
            "key": "status",
            "tableInfo": {
              "alias": null,
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "_$$": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
          "_cols": Lazy {
            "_computed": true,
            "_value": {
              "$accountId": SqlTableColumn {
                "columnName": "account_id",
                "format": null,
                "hashId": "SqlTableColumn#(account.account_id as accountId)",
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
              },
              "$createdAt": SqlTableColumn {
                "columnName": "created_at",
                "format": null,
                "hashId": "SqlTableColumn#(account.created_at as createdAt)",
                "id": "SqlTableColumn#7(account.created_at as createdAt)",
                "jsonType": "Date",
                "key": "createdAt",
                "tableInfo": {
                  "alias": null,
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$email": SqlTableColumn {
                "columnName": "email",
                "format": null,
                "hashId": "SqlTableColumn#(account.email)",
                "id": "SqlTableColumn#3(account.email)",
                "jsonType": null,
                "key": "email",
                "tableInfo": {
                  "alias": null,
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$firstName": SqlTableColumn {
                "columnName": "first_name",
                "format": null,
                "hashId": "SqlTableColumn#(account.first_name as firstName)",
                "id": "SqlTableColumn#4(account.first_name as firstName)",
                "jsonType": null,
                "key": "firstName",
                "tableInfo": {
                  "alias": null,
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$lastName": SqlTableColumn {
                "columnName": "last_name",
                "format": null,
                "hashId": "SqlTableColumn#(account.last_name as lastName)",
                "id": "SqlTableColumn#5(account.last_name as lastName)",
                "jsonType": null,
                "key": "lastName",
                "tableInfo": {
                  "alias": null,
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$modifiedAt": SqlTableColumn {
                "columnName": "modified_at",
                "format": null,
                "hashId": "SqlTableColumn#(account.modified_at as modifiedAt)",
                "id": "SqlTableColumn#8(account.modified_at as modifiedAt)",
                "jsonType": "Date",
                "key": "modifiedAt",
                "tableInfo": {
                  "alias": null,
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$notes": SqlTableColumn {
                "columnName": "notes",
                "format": null,
                "hashId": "SqlTableColumn#(account.notes)",
                "id": "SqlTableColumn#6(account.notes)",
                "jsonType": null,
                "key": "notes",
                "tableInfo": {
                  "alias": null,
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$parentId": SqlTableColumn {
                "columnName": "parent_id",
                "format": null,
                "hashId": "SqlTableColumn#(account.parent_id as parentId)",
                "id": "SqlTableColumn#9(account.parent_id as parentId)",
                "jsonType": null,
                "key": "parentId",
                "tableInfo": {
                  "alias": null,
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$status": SqlTableColumn {
                "columnName": "status",
                "format": null,
                "hashId": "SqlTableColumn#(account.status)",
                "id": "SqlTableColumn#2(account.status)",
                "jsonType": null,
                "key": "status",
                "tableInfo": {
                  "alias": null,
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
            },
            "callback": [Function],
          },
          "_crudConfig": {
            "delete": true,
            "insert": true,
            "select": true,
            "update": true,
          },
          "_out": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
          "columnTypes": {
            "createdAt": "Date",
            "modifiedAt": "Date",
          },
          "dbSchema": {},
          "dialect": "sql",
          "fk": [],
          "format": null,
          "hashId": "SqlTable#(main.account)",
          "id": "SqlTable#1(main.account)",
          "pk": [
            "accountId",
          ],
          "source": "",
          "tableInfo": {
            "alias": null,
            "name": "account",
            "out": false,
            "schema": "main",
          },
          "tag": null,
          "type": "SqlTable",
        }
      `);
   });

   test("SqlTable alias should return new SqlTable instance", () => {
      expect(Account.as`parent`).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "hashId": "SqlTableColumn#(parent.account_id as accountId)",
            "id": "SqlTableColumn#1(parent.account_id as accountId)",
            "jsonType": null,
            "key": "accountId",
            "tableInfo": {
              "alias": "parent",
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$createdAt": SqlTableColumn {
            "columnName": "created_at",
            "format": null,
            "hashId": "SqlTableColumn#(parent.created_at as createdAt)",
            "id": "SqlTableColumn#7(parent.created_at as createdAt)",
            "jsonType": "Date",
            "key": "createdAt",
            "tableInfo": {
              "alias": "parent",
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$email": SqlTableColumn {
            "columnName": "email",
            "format": null,
            "hashId": "SqlTableColumn#(parent.email)",
            "id": "SqlTableColumn#3(parent.email)",
            "jsonType": null,
            "key": "email",
            "tableInfo": {
              "alias": "parent",
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$firstName": SqlTableColumn {
            "columnName": "first_name",
            "format": null,
            "hashId": "SqlTableColumn#(parent.first_name as firstName)",
            "id": "SqlTableColumn#4(parent.first_name as firstName)",
            "jsonType": null,
            "key": "firstName",
            "tableInfo": {
              "alias": "parent",
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$lastName": SqlTableColumn {
            "columnName": "last_name",
            "format": null,
            "hashId": "SqlTableColumn#(parent.last_name as lastName)",
            "id": "SqlTableColumn#5(parent.last_name as lastName)",
            "jsonType": null,
            "key": "lastName",
            "tableInfo": {
              "alias": "parent",
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$modifiedAt": SqlTableColumn {
            "columnName": "modified_at",
            "format": null,
            "hashId": "SqlTableColumn#(parent.modified_at as modifiedAt)",
            "id": "SqlTableColumn#8(parent.modified_at as modifiedAt)",
            "jsonType": "Date",
            "key": "modifiedAt",
            "tableInfo": {
              "alias": "parent",
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$notes": SqlTableColumn {
            "columnName": "notes",
            "format": null,
            "hashId": "SqlTableColumn#(parent.notes)",
            "id": "SqlTableColumn#6(parent.notes)",
            "jsonType": null,
            "key": "notes",
            "tableInfo": {
              "alias": "parent",
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$parentId": SqlTableColumn {
            "columnName": "parent_id",
            "format": null,
            "hashId": "SqlTableColumn#(parent.parent_id as parentId)",
            "id": "SqlTableColumn#9(parent.parent_id as parentId)",
            "jsonType": null,
            "key": "parentId",
            "tableInfo": {
              "alias": "parent",
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$status": SqlTableColumn {
            "columnName": "status",
            "format": null,
            "hashId": "SqlTableColumn#(parent.status)",
            "id": "SqlTableColumn#2(parent.status)",
            "jsonType": null,
            "key": "status",
            "tableInfo": {
              "alias": "parent",
              "name": "account",
              "out": false,
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "_$$": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
          "_cols": Lazy {
            "_computed": true,
            "_value": {
              "$accountId": SqlTableColumn {
                "columnName": "account_id",
                "format": null,
                "hashId": "SqlTableColumn#(parent.account_id as accountId)",
                "id": "SqlTableColumn#1(parent.account_id as accountId)",
                "jsonType": null,
                "key": "accountId",
                "tableInfo": {
                  "alias": "parent",
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$createdAt": SqlTableColumn {
                "columnName": "created_at",
                "format": null,
                "hashId": "SqlTableColumn#(parent.created_at as createdAt)",
                "id": "SqlTableColumn#7(parent.created_at as createdAt)",
                "jsonType": "Date",
                "key": "createdAt",
                "tableInfo": {
                  "alias": "parent",
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$email": SqlTableColumn {
                "columnName": "email",
                "format": null,
                "hashId": "SqlTableColumn#(parent.email)",
                "id": "SqlTableColumn#3(parent.email)",
                "jsonType": null,
                "key": "email",
                "tableInfo": {
                  "alias": "parent",
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$firstName": SqlTableColumn {
                "columnName": "first_name",
                "format": null,
                "hashId": "SqlTableColumn#(parent.first_name as firstName)",
                "id": "SqlTableColumn#4(parent.first_name as firstName)",
                "jsonType": null,
                "key": "firstName",
                "tableInfo": {
                  "alias": "parent",
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$lastName": SqlTableColumn {
                "columnName": "last_name",
                "format": null,
                "hashId": "SqlTableColumn#(parent.last_name as lastName)",
                "id": "SqlTableColumn#5(parent.last_name as lastName)",
                "jsonType": null,
                "key": "lastName",
                "tableInfo": {
                  "alias": "parent",
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$modifiedAt": SqlTableColumn {
                "columnName": "modified_at",
                "format": null,
                "hashId": "SqlTableColumn#(parent.modified_at as modifiedAt)",
                "id": "SqlTableColumn#8(parent.modified_at as modifiedAt)",
                "jsonType": "Date",
                "key": "modifiedAt",
                "tableInfo": {
                  "alias": "parent",
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$notes": SqlTableColumn {
                "columnName": "notes",
                "format": null,
                "hashId": "SqlTableColumn#(parent.notes)",
                "id": "SqlTableColumn#6(parent.notes)",
                "jsonType": null,
                "key": "notes",
                "tableInfo": {
                  "alias": "parent",
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$parentId": SqlTableColumn {
                "columnName": "parent_id",
                "format": null,
                "hashId": "SqlTableColumn#(parent.parent_id as parentId)",
                "id": "SqlTableColumn#9(parent.parent_id as parentId)",
                "jsonType": null,
                "key": "parentId",
                "tableInfo": {
                  "alias": "parent",
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$status": SqlTableColumn {
                "columnName": "status",
                "format": null,
                "hashId": "SqlTableColumn#(parent.status)",
                "id": "SqlTableColumn#2(parent.status)",
                "jsonType": null,
                "key": "status",
                "tableInfo": {
                  "alias": "parent",
                  "name": "account",
                  "out": false,
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
            },
            "callback": [Function],
          },
          "_crudConfig": {
            "delete": true,
            "insert": true,
            "select": true,
            "update": true,
          },
          "_out": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
          "columnTypes": {
            "createdAt": "Date",
            "modifiedAt": "Date",
          },
          "dbSchema": {},
          "dialect": "sql",
          "fk": [],
          "format": null,
          "hashId": "SqlTable#(main.account as parent)",
          "id": "SqlTable#1(main.account as parent)",
          "pk": [
            "accountId",
          ],
          "source": "",
          "tableInfo": {
            "alias": "parent",
            "name": "account",
            "out": false,
            "schema": "main",
          },
          "tag": null,
          "type": "SqlTable",
        }
      `);
   });

   test("SqlTable alias should return new SqlColumn instance", () => {
      expect(Account.as`parent`.$accountId).toMatchInlineSnapshot(`
        SqlTableColumn {
          "columnName": "account_id",
          "format": null,
          "hashId": "SqlTableColumn#(parent.account_id as accountId)",
          "id": "SqlTableColumn#1(parent.account_id as accountId)",
          "jsonType": null,
          "key": "accountId",
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

   test("SqlTable alias should return new SqlTable instance with respective $$ columns", () => {
      expect(Account.as`inserted`.$$).toMatchInlineSnapshot(`
        SqlTableAll {
          "hashId": "SqlTableAll#(SqlTableColumn#(inserted.account_id as accountId),SqlTableColumn#(inserted.status),SqlTableColumn#(inserted.email),SqlTableColumn#(inserted.first_name as firstName),SqlTableColumn#(inserted.last_name as lastName),SqlTableColumn#(inserted.notes),SqlTableColumn#(inserted.created_at as createdAt),SqlTableColumn#(inserted.modified_at as modifiedAt),SqlTableColumn#(inserted.parent_id as parentId))",
          "id": "SqlTableAll#1($accountId, $status, $email, $firstName, $lastName, $notes, $createdAt, $modifiedAt, $parentId)",
          "row": {
            "$accountId": SqlTableColumn {
              "columnName": "account_id",
              "format": null,
              "hashId": "SqlTableColumn#(inserted.account_id as accountId)",
              "id": "SqlTableColumn#1(inserted.account_id as accountId)",
              "jsonType": null,
              "key": "accountId",
              "tableInfo": {
                "alias": "inserted",
                "name": "account",
                "out": false,
                "schema": "main",
              },
              "tag": null,
              "type": "SqlTableColumn",
            },
            "$createdAt": SqlTableColumn {
              "columnName": "created_at",
              "format": null,
              "hashId": "SqlTableColumn#(inserted.created_at as createdAt)",
              "id": "SqlTableColumn#7(inserted.created_at as createdAt)",
              "jsonType": "Date",
              "key": "createdAt",
              "tableInfo": {
                "alias": "inserted",
                "name": "account",
                "out": false,
                "schema": "main",
              },
              "tag": null,
              "type": "SqlTableColumn",
            },
            "$email": SqlTableColumn {
              "columnName": "email",
              "format": null,
              "hashId": "SqlTableColumn#(inserted.email)",
              "id": "SqlTableColumn#3(inserted.email)",
              "jsonType": null,
              "key": "email",
              "tableInfo": {
                "alias": "inserted",
                "name": "account",
                "out": false,
                "schema": "main",
              },
              "tag": null,
              "type": "SqlTableColumn",
            },
            "$firstName": SqlTableColumn {
              "columnName": "first_name",
              "format": null,
              "hashId": "SqlTableColumn#(inserted.first_name as firstName)",
              "id": "SqlTableColumn#4(inserted.first_name as firstName)",
              "jsonType": null,
              "key": "firstName",
              "tableInfo": {
                "alias": "inserted",
                "name": "account",
                "out": false,
                "schema": "main",
              },
              "tag": null,
              "type": "SqlTableColumn",
            },
            "$lastName": SqlTableColumn {
              "columnName": "last_name",
              "format": null,
              "hashId": "SqlTableColumn#(inserted.last_name as lastName)",
              "id": "SqlTableColumn#5(inserted.last_name as lastName)",
              "jsonType": null,
              "key": "lastName",
              "tableInfo": {
                "alias": "inserted",
                "name": "account",
                "out": false,
                "schema": "main",
              },
              "tag": null,
              "type": "SqlTableColumn",
            },
            "$modifiedAt": SqlTableColumn {
              "columnName": "modified_at",
              "format": null,
              "hashId": "SqlTableColumn#(inserted.modified_at as modifiedAt)",
              "id": "SqlTableColumn#8(inserted.modified_at as modifiedAt)",
              "jsonType": "Date",
              "key": "modifiedAt",
              "tableInfo": {
                "alias": "inserted",
                "name": "account",
                "out": false,
                "schema": "main",
              },
              "tag": null,
              "type": "SqlTableColumn",
            },
            "$notes": SqlTableColumn {
              "columnName": "notes",
              "format": null,
              "hashId": "SqlTableColumn#(inserted.notes)",
              "id": "SqlTableColumn#6(inserted.notes)",
              "jsonType": null,
              "key": "notes",
              "tableInfo": {
                "alias": "inserted",
                "name": "account",
                "out": false,
                "schema": "main",
              },
              "tag": null,
              "type": "SqlTableColumn",
            },
            "$parentId": SqlTableColumn {
              "columnName": "parent_id",
              "format": null,
              "hashId": "SqlTableColumn#(inserted.parent_id as parentId)",
              "id": "SqlTableColumn#9(inserted.parent_id as parentId)",
              "jsonType": null,
              "key": "parentId",
              "tableInfo": {
                "alias": "inserted",
                "name": "account",
                "out": false,
                "schema": "main",
              },
              "tag": null,
              "type": "SqlTableColumn",
            },
            "$status": SqlTableColumn {
              "columnName": "status",
              "format": null,
              "hashId": "SqlTableColumn#(inserted.status)",
              "id": "SqlTableColumn#2(inserted.status)",
              "jsonType": null,
              "key": "status",
              "tableInfo": {
                "alias": "inserted",
                "name": "account",
                "out": false,
                "schema": "main",
              },
              "tag": null,
              "type": "SqlTableColumn",
            },
          },
          "tag": null,
          "type": "SqlTableAll",
        }
      `);
   });

   test("SqlTable with fk and dbSchema options stores them correctly", () => {
      const TableWithFk = newSqlTable<{
         Select: { id: string; accountId: string };
         Insert: { id?: string; accountId: string };
         Update: { accountId?: string };
         Delete: true;
      }>({
         crud: { select: true, insert: true, update: true, delete: true },
         tableInfo: { name: "order", schema: "public", out: false, alias: null },
         pk: ["id"],
         columns: { id: "id", accountId: "account_id" },
         fk: [{ from: ["accountId"], to: { schema: "public", table: "account", columns: ["id"] } }],
         dbSchema: {
            id: { dbType: "uuid", type: "string" as const, default: "gen_random_uuid()" },
            accountId: { dbType: "uuid", type: "string" as const },
         },
      });

      expect(TableWithFk.fk).toMatchInlineSnapshot(`
        [
          {
            "from": [
              "accountId",
            ],
            "to": {
              "columns": [
                "id",
              ],
              "schema": "public",
              "table": "account",
            },
          },
        ]
      `);
      expect(TableWithFk.dbSchema).toMatchInlineSnapshot(`
        {
          "accountId": {
            "dbType": "uuid",
            "type": "string",
          },
          "id": {
            "dbType": "uuid",
            "default": "gen_random_uuid()",
            "type": "string",
          },
        }
      `);
   });

   test("SqlTable.resolve() finds registered tables by source:schema.table", () => {
      const Account = newSqlTable<{ Select: { id: string }; Insert: { id: string }; Update: { id?: string }; Delete: true }>({
         crud: { select: true, insert: true, update: true, delete: true },
         tableInfo: { name: "account", schema: "public", out: false, alias: null },
         pk: ["id"],
         columns: { id: "id" },
         source: "my-app:src/codegen",
      });

      const resolved = SqlTable.resolve({ source: "my-app:src/codegen", schema: "public", table: "account" });
      expect(resolved).toBe(Account);
   });

   test("SqlTable.resolve() returns undefined for unregistered tables", () => {
      const resolved = SqlTable.resolve({ source: "unknown:path", schema: "public", table: "nonexistent" });
      expect(resolved).toMatchInlineSnapshot(`undefined`);
   });

   test("resolveFk() resolves FK to target table instance", () => {
      const source = "fk-test:src/models";
      const Account = newSqlTable<{ Select: { id: string }; Insert: { id: string }; Update: { id?: string }; Delete: true }>({
         crud: { select: true, insert: true, update: true, delete: true },
         tableInfo: { name: "account", schema: "app", out: false, alias: null },
         pk: ["id"],
         columns: { id: "id" },
         source,
      });

      const Order = newSqlTable<{ Select: { id: string; accountId: string }; Insert: { id: string; accountId: string }; Update: { id?: string }; Delete: true }>({
         crud: { select: true, insert: true, update: true, delete: true },
         tableInfo: { name: "order", schema: "app", out: false, alias: null },
         pk: ["id"],
         columns: { id: "id", accountId: "account_id" },
         source,
         fk: [{ from: ["accountId"], to: { schema: "app", table: "account", columns: ["id"] } }],
      });

      const resolved = Order.resolveFk(Order.fk[0]!);
      expect(resolved).toBe(Account);
   });

   test("resolveFk() returns undefined when target table is not registered", () => {
      const Orphan = newSqlTable<{ Select: { id: string }; Insert: { id: string }; Update: { id?: string }; Delete: true }>({
         crud: { select: true, insert: true, update: true, delete: true },
         tableInfo: { name: "orphan", schema: "app", out: false, alias: null },
         pk: ["id"],
         columns: { id: "id" },
         source: "orphan-test:models",
         fk: [{ from: ["id"], to: { schema: "app", table: "missing", columns: ["id"] } }],
      });

      expect(Orphan.resolveFk(Orphan.fk[0]!)).toMatchInlineSnapshot(`undefined`);
   });

   test("aliased tables do not register in the registry", () => {
      const Base = newSqlTable<{ Select: { id: string }; Insert: { id: string }; Update: { id?: string }; Delete: true }>({
         crud: { select: true, insert: true, update: true, delete: true },
         tableInfo: { name: "base", schema: "app", out: false, alias: null },
         pk: ["id"],
         columns: { id: "id" },
         source: "alias-test:models",
      });

      const Aliased = Base.as("b");
      expect(SqlTable.resolve({ source: "alias-test:models", schema: "app", table: "base" })).toBe(Base);
      expect(Aliased.tableInfo.alias).toMatchInlineSnapshot(`"b"`);
   });

   test("tables without source do not register in the registry", () => {
      const NoSource = newSqlTable<{ Select: { id: string }; Insert: { id: string }; Update: { id?: string }; Delete: true }>({
         crud: { select: true, insert: true, update: true, delete: true },
         tableInfo: { name: "nosource", schema: "app", out: false, alias: null },
         pk: ["id"],
         columns: { id: "id" },
      });

      expect(NoSource.source).toMatchInlineSnapshot(`""`);
      expect(SqlTable.resolve({ source: "", schema: "app", table: "nosource" })).toMatchInlineSnapshot(`undefined`);
   });
});