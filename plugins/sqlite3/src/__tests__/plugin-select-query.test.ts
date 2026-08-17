import { describe, expect, test } from "vitest";
import { Account, Order } from "@vexnor/core/testing";
import { VexnorSqlite3 } from "#src/vexnor-sqlite3.js";
import { defaultQueryOptions } from "#src/crud/default-query-options.js";

describe("VexnorSqlite3.newSelectQuery", () => {
   const plugin = new VexnorSqlite3();

   test("uses the existing SQLite select command for runtime table reads", () => {
      const query = plugin.newSelectQuery(Account);
      expect(query.getSql({ params: { limit: 10, offset: 5 }, options: defaultQueryOptions })).toMatchInlineSnapshot(`
        {
          "text": "/* <query_0> */
        /* driver: sqlite */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
        LIMIT
          ?
        OFFSET
          ?
          /* </query_0> */",
          "values": [
            10,
            5,
          ],
        }
      `);
   });

   test("uses the existing SQLite select command for runtime joins", () => {
      const query = plugin.newSelectQuery(Account, { order: Order });
      expect(
         query.getSql({
            params: {
               joinBy: { order: { on: [["accountId", "=", "order.accountId"]] } },
               limit: 10,
               offset: 5,
            },
            options: defaultQueryOptions,
         }),
      ).toMatchInlineSnapshot(`
        {
          "text": "/* <query_0> */
        /* driver: sqlite */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId"
        FROM
          "main"."account" AS "a_1"
          JOIN "main"."order" AS "o_2" ON "a_1"."account_id" = "o_2"."account_id"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
        LIMIT
          ?
        OFFSET
          ?
          /* </query_0> */",
          "values": [
            10,
            5,
          ],
        }
      `);
   });
});
