import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { DataSource, Entity, PrimaryGeneratedColumn, PrimaryColumn, Column, ObjectLiteral, Repository } from "typeorm";
import { sql, row, SqlTable } from "vexnor";
import { fromTypeORM } from "../index.js";

@Entity({ name: "account", schema: "main" })
class AccountEntity {
   @PrimaryGeneratedColumn("uuid", { name: "account_id" })
   accountId!: string;

   @Column({ name: "email", type: String })
   email!: string;

   @Column({ name: "first_name", type: String })
   firstName!: string;

   @Column({ name: "parent_id", nullable: true, type: String })
   parentId!: string | null;
}

@Entity({ name: "order_item", schema: "main" })
class OrderItemEntity {
   @PrimaryColumn({ name: "order_id", type: String })
   orderId!: string;

   @PrimaryColumn({ name: "product_id", type: String })
   productId!: string;

   @Column({ name: "quantity", type: Number })
   quantity!: number;
}

let dataSource: DataSource;

beforeAll(async () => {
   dataSource = new DataSource({
      type: "better-sqlite3",
      database: ":memory:",
      entities: [AccountEntity, OrderItemEntity],
   });
   await dataSource.initialize();
});

afterAll(async () => {
   await dataSource.destroy();
});

describe("fromTypeORM — decorator entities", () => {
   test("returns SqlTable instance", () => {
      expect(fromTypeORM(dataSource.getRepository(AccountEntity))).toBeInstanceOf(SqlTable);
   });

   test("fromTypeORM — decorator entity", () => {
      expect(fromTypeORM(dataSource.getRepository(AccountEntity))).toMatchInlineSnapshot(`
        SqlTable {
          "$accountId": SqlTableColumn {
            "columnName": "account_id",
            "columnType": null,
            "format": null,
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
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
            "columnType": null,
            "format": null,
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
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
            "columnType": null,
            "format": null,
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
            "id": "SqlTableColumn#3(account.first_name as firstName)",
            "key": "firstName",
            "tableInfo": {
              "name": "account",
              "schema": "main",
            },
            "tag": null,
            "type": "SqlTableColumn",
          },
          "$parentId": SqlTableColumn {
            "columnName": "parent_id",
            "columnType": null,
            "format": null,
            "hashIdLazy": Lazy {
              "_computed": false,
              "_value": null,
              "callback": [Function],
            },
            "id": "SqlTableColumn#4(account.parent_id as parentId)",
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
                "columnType": null,
                "format": null,
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
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
                "columnType": null,
                "format": null,
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
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
                "columnType": null,
                "format": null,
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
                "id": "SqlTableColumn#3(account.first_name as firstName)",
                "key": "firstName",
                "tableInfo": {
                  "name": "account",
                  "schema": "main",
                },
                "tag": null,
                "type": "SqlTableColumn",
              },
              "$parentId": SqlTableColumn {
                "columnName": "parent_id",
                "columnType": null,
                "format": null,
                "hashIdLazy": Lazy {
                  "_computed": false,
                  "_value": null,
                  "callback": [Function],
                },
                "id": "SqlTableColumn#4(account.parent_id as parentId)",
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
          "columnTypes": {},
          "dialect": "sqlite",
          "format": null,
          "hashIdLazy": Lazy {
            "_computed": false,
            "_value": null,
            "callback": [Function],
          },
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

   test("pk — composite via @PrimaryColumn", () => {
      expect(fromTypeORM(dataSource.getRepository(OrderItemEntity) as Repository<OrderItemEntity & ObjectLiteral>).pk)
         .toMatchInlineSnapshot(`
        [
          "orderId",
          "productId",
        ]
      `);
   });

   test("SELECT all columns", () => {
      const Account = fromTypeORM(dataSource.getRepository(AccountEntity) as Repository<AccountEntity & ObjectLiteral>);
      expect(sql`SELECT ${row(Account.$$)} FROM ${Account}`.getSql({}).text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1" /* </query_0> */"
      `);
   });
});
