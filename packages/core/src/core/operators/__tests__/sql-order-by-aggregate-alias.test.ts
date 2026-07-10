// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

describe("SqlOrderBy — aggregate alias-aware (Bug 3 fix)", () => {
   test("orderBy key matching an aggregate alias uses the quoted alias (not raw column)", () => {
      const query = sqlSelect(Account, {});
      const result = query.getSql({
         params: {
            select: {
               status: true,
               total: { fn: "count", col: "*" },
            },
            orderBy: { total: "DESC" },
         },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."status",
          count(*) AS "total"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
        GROUP BY
          "a_1"."status" /* </query_2> */
          /* <query_3> */
          /* </query_3> */
        ORDER BY
          "total" DESC
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("orderBy key NOT matching any aggregate alias but IS a real column resolves normally", () => {
      const query = sqlSelect(Account, {});
      const result = query.getSql({
         params: {
            select: {
               status: true,
               total: { fn: "count", col: "*" },
            },
            orderBy: { status: "ASC" },
         },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."status",
          count(*) AS "total"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
        GROUP BY
          "a_1"."status" /* </query_2> */
          /* <query_3> */
          /* </query_3> */
        ORDER BY
          "a_1"."status" ASC
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("orderBy key matching a non-aggregate select alias resolves via column map", () => {
      const query = sqlSelect(Account, {});
      const result = query.getSql({
         params: {
            select: {
               email: true,
               latest: { fn: "max", col: "createdAt" },
            },
            orderBy: { email: "ASC" },
         },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."email",
          max("a_1"."created_at") AS "latest"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
        GROUP BY
          "a_1"."email" /* </query_2> */
          /* <query_3> */
          /* </query_3> */
        ORDER BY
          "a_1"."email" ASC
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("orderBy with multiple keys — aggregate alias + real column", () => {
      const query = sqlSelect(Account, {});
      const result = query.getSql({
         params: {
            select: {
               status: true,
               totalOrders: { fn: "count", col: "*" },
            },
            orderBy: { totalOrders: "DESC", status: "ASC" },
         },
         options: { dialect: "sqlite" },
      });
      expect(result.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."status",
          count(*) AS "totalOrders"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
        GROUP BY
          "a_1"."status" /* </query_2> */
          /* <query_3> */
          /* </query_3> */
        ORDER BY
          "totalOrders" DESC,
          "a_1"."status" ASC
          /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`[]`);
   });
});
