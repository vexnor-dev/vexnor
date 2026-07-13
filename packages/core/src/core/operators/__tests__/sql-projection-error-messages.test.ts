// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

describe("SqlProjectBy.resolveColumn — improved error messages (Bug 1 fix)", () => {
   test("dot-prefixed name that doesn't exist throws with 'add it to joinBy' message", () => {
      const query = sqlSelect(Account, {});
      expect(() =>
         query.getSql({
            params: { select: { total: { fn: "sum", col: "invoice.amount" } } },
            options: { dialect: "sqlite" },
         }),
      ).toThrow('Column "invoice.amount" not found. If "invoice" is a joined table, add it to joinBy.');
   });

   test("non-dot-prefixed name that doesn't exist throws the standard 'Column not found' error", () => {
      const query = sqlSelect(Account, {});
      expect(() =>
         query.getSql({
            params: { select: { total: { fn: "sum", col: "nonExistentColumn" } } },
            options: { dialect: "sqlite" },
         }),
      ).toThrow("Column not found: nonExistentColumn");
   });

   test("dot-prefixed name where column exists on root table still resolves (no error)", () => {
      // "account.email" should resolve to the email column on the root table
      const query = sqlSelect(Account, {});
      const { text } = query.getSql({
         params: { select: { mail: { fn: "count", col: "account.email" } } },
         options: { dialect: "sqlite" },
      });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          count("a_1"."email") AS "mail"
        FROM
          "main"."account" AS "a_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
          /* </query_0> */"
      `);
   });

   test("column rename with dot-prefixed unknown table throws joinBy message", () => {
      const query = sqlSelect(Account, {});
      expect(() =>
         query.getSql({
            params: { select: { foo: "orders.total" } },
            options: { dialect: "sqlite" },
         }),
      ).toThrow('Column "orders.total" not found. If "orders" is a joined table, add it to joinBy.');
   });
});
