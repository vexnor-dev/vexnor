import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DataSource, EntitySchema } from "typeorm";
import { SqlTable } from "valnor";
import { fromTypeORM } from "../index.js";

interface IAccount extends Record<string, unknown> {
   accountId: string;
   email: string;
   firstName: string;
   notes: string | null;
   parentId: string | null;
}

const AccountSchema = new EntitySchema<IAccount>({
   name: "Account",
   tableName: "account",
   schema: "main",
   columns: {
      accountId: { type: String, primary: true, name: "account_id" },
      email: { type: String, name: "email", nullable: false },
      firstName: { type: String, name: "first_name", nullable: false },
      notes: { type: String, name: "notes", nullable: true },
      parentId: { type: String, name: "parent_id", nullable: true },
   },
});

const OrderWithRelationSchema = new EntitySchema<{ orderId: string; total: number | null } & Record<string, unknown>>({
   name: "OrderWithRelation",
   tableName: "order",
   schema: "main",
   columns: {
      orderId: { type: String, primary: true, name: "order_id" },
      total: { type: Number, name: "total", nullable: true },
   },
   relations: {
      account: { type: "many-to-one", target: "Account", joinColumn: { name: "account_id" } },
   },
});

const ViewSchema = new EntitySchema<{ accountId: string; email: string } & Record<string, unknown>>({
   name: "AccountView",
   tableName: "account",
   schema: "main",
   type: "view",
   columns: {
      accountId: { type: String, primary: true, name: "account_id" },
      email: { type: String, name: "email" },
   },
});

let dataSource: DataSource;

beforeAll(async () => {
   dataSource = new DataSource({
      type: "better-sqlite3",
      database: ":memory:",
      entities: [AccountSchema, OrderWithRelationSchema, ViewSchema],
   });
   await dataSource.initialize();
});

afterAll(async () => {
   await dataSource.destroy();
});

describe("fromTypeORM — EntitySchema metadata", () => {
   test("returns SqlTable instance", () => {
      expect(fromTypeORM(dataSource.getRepository(AccountSchema))).toBeInstanceOf(SqlTable);
   });

   test("fromTypeORM — full table snapshot", () => {
      expect(fromTypeORM(dataSource.getRepository(AccountSchema))).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "format": null,
            "id": "SqlTableColumn#1(account.account_id as accountId)",
            "key": "accountId",
            "tableInfo": {
              "name": "account",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$email": SqlTableColumn {
            "columnName": "email",
            "format": null,
            "id": "SqlTableColumn#2(account.email)",
            "key": "email",
            "tableInfo": {
              "name": "account",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$firstName": SqlTableColumn {
            "columnName": "first_name",
            "format": null,
            "id": "SqlTableColumn#3(account.first_name as firstName)",
            "key": "firstName",
            "tableInfo": {
              "name": "account",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$notes": SqlTableColumn {
            "columnName": "notes",
            "format": null,
            "id": "SqlTableColumn#4(account.notes)",
            "key": "notes",
            "tableInfo": {
              "name": "account",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$parentId": SqlTableColumn {
            "columnName": "parent_id",
            "format": null,
            "id": "SqlTableColumn#5(account.parent_id as parentId)",
            "key": "parentId",
            "tableInfo": {
              "name": "account",
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
                "id": "SqlTableColumn#1(account.account_id as accountId)",
                "key": "accountId",
                "tableInfo": {
                  "name": "account",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$email": SqlTableColumn {
                "columnName": "email",
                "format": null,
                "id": "SqlTableColumn#2(account.email)",
                "key": "email",
                "tableInfo": {
                  "name": "account",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$firstName": SqlTableColumn {
                "columnName": "first_name",
                "format": null,
                "id": "SqlTableColumn#3(account.first_name as firstName)",
                "key": "firstName",
                "tableInfo": {
                  "name": "account",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$notes": SqlTableColumn {
                "columnName": "notes",
                "format": null,
                "id": "SqlTableColumn#4(account.notes)",
                "key": "notes",
                "tableInfo": {
                  "name": "account",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$parentId": SqlTableColumn {
                "columnName": "parent_id",
                "format": null,
                "id": "SqlTableColumn#5(account.parent_id as parentId)",
                "key": "parentId",
                "tableInfo": {
                  "name": "account",
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
          "dialect": "sqlite",
          "format": null,
          "id": "SqlTable#2(main.account)",
          "pk": [
            "accountId",
          ],
          "tableInfo": {
            "name": "account",
            "schema": "main",
          },
          "tag": null,
          "type": "SqlTable",
        }
      `);
   });

   test("tableInfo.schema", () => {
      expect(fromTypeORM(dataSource.getRepository(AccountSchema)).tableInfo.schema).toMatchInlineSnapshot(`"main"`);
   });

   test("pk — single", () => {
      expect(fromTypeORM(dataSource.getRepository(AccountSchema)).pk).toMatchInlineSnapshot(`
        [
          "accountId",
        ]
      `);
   });

   test("dialect — better-sqlite3 maps to sqlite", () => {
      expect(fromTypeORM(dataSource.getRepository(AccountSchema)).dialect).toMatchInlineSnapshot(`"sqlite"`);
   });

   test("crud", () => {
      expect(fromTypeORM(dataSource.getRepository(AccountSchema)).crud).toMatchInlineSnapshot(`
        {
          "delete": true,
          "insert": true,
          "select": true,
          "update": true,
        }
      `);
   });

   test("relation FK virtual columns are skipped", () => {
      const Order = fromTypeORM(dataSource.getRepository(OrderWithRelationSchema));
      expect(Object.keys(Order.cols)).toMatchInlineSnapshot(`
        [
          "$orderId",
          "$total",
        ]
      `);
   });

   test("view — crud is select-only", () => {
      const view = fromTypeORM(dataSource.getRepository(ViewSchema));
      expect(view.crud).toMatchInlineSnapshot(`
        {
          "delete": false,
          "insert": false,
          "select": true,
          "update": false,
        }
      `);
   });
});
