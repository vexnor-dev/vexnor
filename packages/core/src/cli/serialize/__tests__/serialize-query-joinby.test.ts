import { describe, expect, test } from "vitest";
import { serializeQuery } from "#src/core/serialize/serialize-query.js";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { filterBy } from "#src/core/operators/sql-filter-by.js";
import { orderBy } from "#src/core/operators/sql-order-by.js";
import { SqlJoinBy } from "#src/core/operators/sql-join-by.js";
import { Account, Order, OrderItem } from "@test-models/vexnor_dev.schema.js";

describe("serializeQuery — joinBy operator", () => {
   test("serializes joinBy with single table in joinMap", async () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", {}, { account: Account });

      const query = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         ${joinByOp}
      `;

      const result = await serializeQuery(query, "ordersWithJoin", "postgresql");

      const { hash, ...stable } = result;
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(stable).toMatchInlineSnapshot(`
        {
          "authorization": [],
          "location": null,
          "name": "ordersWithJoin",
          "params": {
            "joinBy": {
              "isContext": false,
              "name": "joinBy",
              "validation": {
                "columns": [
                  "account.accountId",
                  "account.status",
                  "account.email",
                  "account.firstName",
                  "account.lastName",
                  "account.notes",
                  "account.createdAt",
                  "account.modifiedAt",
                  "account.parentId",
                ],
                "operators": [
                  "=",
                  "<",
                  "<=",
                  ">",
                  ">=",
                  "<>",
                ],
                "type": "joinBy",
              },
            },
          },
          "row": {
            "createdAt": {
              "type": "Date",
            },
            "modifiedAt": {
              "type": "Date",
            },
          },
          "template": [
            {
              "type": "text",
              "value": " /* <query_0> */ 
                 SELECT "o_1"."order_id" as "orderId", "o_1"."status", "o_1"."created_at" as "createdAt", "o_1"."modified_at" as "modifiedAt", "o_1"."account_id" as "accountId"
                 FROM "main"."order" as "o_1"
                 ",
            },
            {
              "joinMap": {
                "_": {
                  "columns": {
                    "accountId": ""o_1"."account_id"",
                    "createdAt": ""o_1"."created_at"",
                    "modifiedAt": ""o_1"."modified_at"",
                    "orderId": ""o_1"."order_id"",
                    "status": ""o_1"."status"",
                  },
                  "schema": "main",
                  "table": "order",
                },
                "account": {
                  "columns": {
                    "accountId": ""a_2"."account_id"",
                    "createdAt": ""a_2"."created_at"",
                    "email": ""a_2"."email"",
                    "firstName": ""a_2"."first_name"",
                    "lastName": ""a_2"."last_name"",
                    "modifiedAt": ""a_2"."modified_at"",
                    "notes": ""a_2"."notes"",
                    "parentId": ""a_2"."parent_id"",
                    "status": ""a_2"."status"",
                  },
                  "schema": "main",
                  "table": "account",
                },
              },
              "joinTypes": {},
              "param": "joinBy",
              "type": "joinBy",
            },
            {
              "type": "text",
              "value": "
              /* </query_0> */",
            },
          ],
        }
      `);
   });

   test("serializes joinBy with multiple tables in joinMap", async () => {
      const joinByOp = new SqlJoinBy(OrderItem, "joinBy", { account: "left" }, { order: Order, account: Account });

      const query = sql`
         SELECT ${row(OrderItem.$$)}
         FROM ${OrderItem}
         ${joinByOp}
      `;

      const result = await serializeQuery(query, "itemsWithJoins", "postgresql");

      const { hash, ...stable } = result;
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(stable).toMatchInlineSnapshot(`
        {
          "authorization": [],
          "location": null,
          "name": "itemsWithJoins",
          "params": {
            "joinBy": {
              "isContext": false,
              "name": "joinBy",
              "validation": {
                "columns": [
                  "order.orderId",
                  "order.status",
                  "order.createdAt",
                  "order.modifiedAt",
                  "order.accountId",
                  "account.accountId",
                  "account.status",
                  "account.email",
                  "account.firstName",
                  "account.lastName",
                  "account.notes",
                  "account.createdAt",
                  "account.modifiedAt",
                  "account.parentId",
                ],
                "operators": [
                  "=",
                  "<",
                  "<=",
                  ">",
                  ">=",
                  "<>",
                ],
                "type": "joinBy",
              },
            },
          },
          "row": null,
          "template": [
            {
              "type": "text",
              "value": " /* <query_0> */ 
                 SELECT "oi_1"."product_price" as "productPrice", "oi_1"."order_item_id" as "orderItemId", "oi_1"."quantity", "oi_1"."discount_price" as "discountPrice", "oi_1"."modified_at" as "modifiedAt", "oi_1"."created_at" as "createdAt", "oi_1"."order_id" as "orderId", "oi_1"."product_id" as "productId"
                 FROM "main"."order_item" as "oi_1"
                 ",
            },
            {
              "joinMap": {
                "_": {
                  "columns": {
                    "createdAt": ""oi_1"."created_at"",
                    "discountPrice": ""oi_1"."discount_price"",
                    "modifiedAt": ""oi_1"."modified_at"",
                    "orderId": ""oi_1"."order_id"",
                    "orderItemId": ""oi_1"."order_item_id"",
                    "productId": ""oi_1"."product_id"",
                    "productPrice": ""oi_1"."product_price"",
                    "quantity": ""oi_1"."quantity"",
                  },
                  "schema": "main",
                  "table": "order_item",
                },
                "account": {
                  "columns": {
                    "accountId": ""a_3"."account_id"",
                    "createdAt": ""a_3"."created_at"",
                    "email": ""a_3"."email"",
                    "firstName": ""a_3"."first_name"",
                    "lastName": ""a_3"."last_name"",
                    "modifiedAt": ""a_3"."modified_at"",
                    "notes": ""a_3"."notes"",
                    "parentId": ""a_3"."parent_id"",
                    "status": ""a_3"."status"",
                  },
                  "schema": "main",
                  "table": "account",
                },
                "order": {
                  "columns": {
                    "accountId": ""o_2"."account_id"",
                    "createdAt": ""o_2"."created_at"",
                    "modifiedAt": ""o_2"."modified_at"",
                    "orderId": ""o_2"."order_id"",
                    "status": ""o_2"."status"",
                  },
                  "schema": "main",
                  "table": "order",
                },
              },
              "joinTypes": {
                "account": "left",
              },
              "param": "joinBy",
              "type": "joinBy",
            },
            {
              "type": "text",
              "value": "
              /* </query_0> */",
            },
          ],
        }
      `);
   });

   test("serializes joinBy with joinTypes defaults", async () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", { account: "left" }, { account: Account });

      const query = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         ${joinByOp}
      `;

      const result = await serializeQuery(query, "ordersLeftJoin", "postgresql");

      const { hash, ...stable } = result;
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(stable).toMatchInlineSnapshot(`
        {
          "authorization": [],
          "location": null,
          "name": "ordersLeftJoin",
          "params": {
            "joinBy": {
              "isContext": false,
              "name": "joinBy",
              "validation": {
                "columns": [
                  "account.accountId",
                  "account.status",
                  "account.email",
                  "account.firstName",
                  "account.lastName",
                  "account.notes",
                  "account.createdAt",
                  "account.modifiedAt",
                  "account.parentId",
                ],
                "operators": [
                  "=",
                  "<",
                  "<=",
                  ">",
                  ">=",
                  "<>",
                ],
                "type": "joinBy",
              },
            },
          },
          "row": {
            "createdAt": {
              "type": "Date",
            },
            "modifiedAt": {
              "type": "Date",
            },
          },
          "template": [
            {
              "type": "text",
              "value": " /* <query_0> */ 
                 SELECT "o_1"."order_id" as "orderId", "o_1"."status", "o_1"."created_at" as "createdAt", "o_1"."modified_at" as "modifiedAt", "o_1"."account_id" as "accountId"
                 FROM "main"."order" as "o_1"
                 ",
            },
            {
              "joinMap": {
                "_": {
                  "columns": {
                    "accountId": ""o_1"."account_id"",
                    "createdAt": ""o_1"."created_at"",
                    "modifiedAt": ""o_1"."modified_at"",
                    "orderId": ""o_1"."order_id"",
                    "status": ""o_1"."status"",
                  },
                  "schema": "main",
                  "table": "order",
                },
                "account": {
                  "columns": {
                    "accountId": ""a_2"."account_id"",
                    "createdAt": ""a_2"."created_at"",
                    "email": ""a_2"."email"",
                    "firstName": ""a_2"."first_name"",
                    "lastName": ""a_2"."last_name"",
                    "modifiedAt": ""a_2"."modified_at"",
                    "notes": ""a_2"."notes"",
                    "parentId": ""a_2"."parent_id"",
                    "status": ""a_2"."status"",
                  },
                  "schema": "main",
                  "table": "account",
                },
              },
              "joinTypes": {
                "account": "left",
              },
              "param": "joinBy",
              "type": "joinBy",
            },
            {
              "type": "text",
              "value": "
              /* </query_0> */",
            },
          ],
        }
      `);
   });

   test("serializes joinBy combined with filterBy and orderBy", async () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", {}, { account: Account });

      const query = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         ${joinByOp}
         WHERE ${filterBy(Order, "filter")}
         ${orderBy(Order, "sort")}
      `;

      const result = await serializeQuery(query, "ordersJoinFilter", "postgresql");

      const { hash, ...stable } = result;
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(stable).toMatchInlineSnapshot(`
        {
          "authorization": [],
          "location": null,
          "name": "ordersJoinFilter",
          "params": {
            "filter": {
              "isContext": false,
              "name": "filter",
              "validation": {
                "columns": [
                  "orderId",
                  "status",
                  "createdAt",
                  "modifiedAt",
                  "accountId",
                ],
                "operators": [
                  "=",
                  "not",
                  "!=",
                  ">",
                  ">=",
                  "<",
                  "<=",
                  "between",
                  "in",
                  "notIn",
                  "like",
                  "notLike",
                  "isNull",
                  "isNotNull",
                ],
                "type": "filter",
              },
            },
            "joinBy": {
              "isContext": false,
              "name": "joinBy",
              "validation": {
                "columns": [
                  "account.accountId",
                  "account.status",
                  "account.email",
                  "account.firstName",
                  "account.lastName",
                  "account.notes",
                  "account.createdAt",
                  "account.modifiedAt",
                  "account.parentId",
                ],
                "operators": [
                  "=",
                  "<",
                  "<=",
                  ">",
                  ">=",
                  "<>",
                ],
                "type": "joinBy",
              },
            },
            "sort": {
              "isContext": false,
              "name": "sort",
            },
          },
          "row": {
            "createdAt": {
              "type": "Date",
            },
            "modifiedAt": {
              "type": "Date",
            },
          },
          "template": [
            {
              "type": "text",
              "value": " /* <query_0> */ 
                 SELECT "o_1"."order_id" as "orderId", "o_1"."status", "o_1"."created_at" as "createdAt", "o_1"."modified_at" as "modifiedAt", "o_1"."account_id" as "accountId"
                 FROM "main"."order" as "o_1"
                 ",
            },
            {
              "joinMap": {
                "_": {
                  "columns": {
                    "accountId": ""o_1"."account_id"",
                    "createdAt": ""o_1"."created_at"",
                    "modifiedAt": ""o_1"."modified_at"",
                    "orderId": ""o_1"."order_id"",
                    "status": ""o_1"."status"",
                  },
                  "schema": "main",
                  "table": "order",
                },
                "account": {
                  "columns": {
                    "accountId": ""a_2"."account_id"",
                    "createdAt": ""a_2"."created_at"",
                    "email": ""a_2"."email"",
                    "firstName": ""a_2"."first_name"",
                    "lastName": ""a_2"."last_name"",
                    "modifiedAt": ""a_2"."modified_at"",
                    "notes": ""a_2"."notes"",
                    "parentId": ""a_2"."parent_id"",
                    "status": ""a_2"."status"",
                  },
                  "schema": "main",
                  "table": "account",
                },
              },
              "joinTypes": {},
              "param": "joinBy",
              "type": "joinBy",
            },
            {
              "type": "text",
              "value": "
                 WHERE ",
            },
            {
              "columns": {
                "accountId": ""o_1"."account_id"",
                "createdAt": ""o_1"."created_at"",
                "modifiedAt": ""o_1"."modified_at"",
                "orderId": ""o_1"."order_id"",
                "status": ""o_1"."status"",
              },
              "param": "filter",
              "type": "filter",
            },
            {
              "type": "text",
              "value": "
                 ",
            },
            {
              "columns": {
                "accountId": ""o_1"."account_id"",
                "createdAt": ""o_1"."created_at"",
                "modifiedAt": ""o_1"."modified_at"",
                "orderId": ""o_1"."order_id"",
                "status": ""o_1"."status"",
              },
              "param": "sort",
              "type": "orderBy",
            },
            {
              "type": "text",
              "value": "
              /* </query_0> */",
            },
          ],
        }
      `);
   });

   test("joinBy param appears in serialized params with joinBy validation schema", async () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", {}, { account: Account });

      const query = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         ${joinByOp}
      `;

      const result = await serializeQuery(query, "withJoinByParam", "postgresql");

      expect(result.params["joinBy"]).toMatchInlineSnapshot(`
        {
          "isContext": false,
          "name": "joinBy",
          "validation": {
            "columns": [
              "account.accountId",
              "account.status",
              "account.email",
              "account.firstName",
              "account.lastName",
              "account.notes",
              "account.createdAt",
              "account.modifiedAt",
              "account.parentId",
            ],
            "operators": [
              "=",
              "<",
              "<=",
              ">",
              ">=",
              "<>",
            ],
            "type": "joinBy",
          },
        }
      `);
   });

   test("serializes joinBy with empty joinMap", async () => {
      const joinByOp = new SqlJoinBy(Order, "joinBy", {}, {});

      const query = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         ${joinByOp}
      `;

      const result = await serializeQuery(query, "ordersNoJoinMap", "postgresql");

      const joinByNode = result.template.find((n) => n.type === "joinBy");
      expect(joinByNode).toMatchInlineSnapshot(`
        {
          "joinMap": {
            "_": {
              "columns": {
                "accountId": ""o_1"."account_id"",
                "createdAt": ""o_1"."created_at"",
                "modifiedAt": ""o_1"."modified_at"",
                "orderId": ""o_1"."order_id"",
                "status": ""o_1"."status"",
              },
              "schema": "main",
              "table": "order",
            },
          },
          "joinTypes": {},
          "param": "joinBy",
          "type": "joinBy",
        }
      `);
   });

   test("serializes joinBy with custom param name", async () => {
      const joinByOp = new SqlJoinBy(Order, "joins", {}, { account: Account });

      const query = sql`
         SELECT ${row(Order.$$)}
         FROM ${Order}
         ${joinByOp}
      `;

      const result = await serializeQuery(query, "customParamName", "postgresql");

      const joinByNode = result.template.find((n) => n.type === "joinBy");
      expect(joinByNode).toMatchInlineSnapshot(`
        {
          "joinMap": {
            "_": {
              "columns": {
                "accountId": ""o_1"."account_id"",
                "createdAt": ""o_1"."created_at"",
                "modifiedAt": ""o_1"."modified_at"",
                "orderId": ""o_1"."order_id"",
                "status": ""o_1"."status"",
              },
              "schema": "main",
              "table": "order",
            },
            "account": {
              "columns": {
                "accountId": ""a_2"."account_id"",
                "createdAt": ""a_2"."created_at"",
                "email": ""a_2"."email"",
                "firstName": ""a_2"."first_name"",
                "lastName": ""a_2"."last_name"",
                "modifiedAt": ""a_2"."modified_at"",
                "notes": ""a_2"."notes"",
                "parentId": ""a_2"."parent_id"",
                "status": ""a_2"."status"",
              },
              "schema": "main",
              "table": "account",
            },
          },
          "joinTypes": {},
          "param": "joins",
          "type": "joinBy",
        }
      `);
   });
});
