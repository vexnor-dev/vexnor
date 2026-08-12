import { describe, expect, test } from "vitest";
import { each, param, sql } from "#src/core/core.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

describe("SqlEach", () => {
   test("simple IN-list — emits placeholder per element", () => {
      const query = sql`SELECT * FROM ${Account} WHERE ${Account.$accountId} IN (${each("ids")})`;

      const result = query.getSql({
         params: { ids: ["a", "b", "c"] },
         options: { dialect: "sql", format: false },
      });

      expect(result.values).toMatchInlineSnapshot(`
        [
          "a",
          "b",
          "c",
        ]
      `);
      expect(result.text).toMatchInlineSnapshot(`" /* <query_0> */ SELECT * FROM "main"."account" as "a_1" WHERE "a_1"."account_id" IN (?, ?, ?)/* </query_0> */"`);
   });

   test("preserves exact parameter types and exposes runtime query metadata", () => {
      const query = sql`
         SELECT * FROM ${Account}
         WHERE ${Account.$accountId} IN (${each<{ ids: string[] }>("ids")})
         AND ${Account.$status} = ${param<{ status: string }>("status")}
      `;

      query.getSql({
         params: { ids: ["a", "b"], status: "active" },
         options: { dialect: "sql", format: false },
      });

      if (false) {
         // @ts-expect-error — ids is required
         query.getSql({ params: { status: "active" } });
         // @ts-expect-error — each() requires an array value
         query.getSql({ params: { ids: "a", status: "active" } });
         // @ts-expect-error — status remains required alongside each()
         query.getSql({ params: { ids: ["a"] } });
         // @ts-expect-error — undeclared parameters are rejected
         void query.params.missing;
      }

      expect({
         ids: {
            name: query.params.ids.name,
            isContext: query.params.ids.isContext,
         },
         status: {
            name: query.params.status.name,
            isContext: query.params.status.isContext,
         },
      }).toMatchInlineSnapshot(`
        {
          "ids": {
            "isContext": false,
            "name": "ids",
          },
          "status": {
            "isContext": false,
            "name": "status",
          },
        }
      `);
   });

   test("empty array produces no output", () => {
      const query = sql`
         WHERE id IN (${each("ids")})
      `;

      const result = query.getSql({
         params: { ids: [] },
         options: { dialect: "sql", format: false },
      });

      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("null/undefined param produces no output", () => {
      const query = sql`
         WHERE id IN (${each("ids")})
      `;

      const result = query.getSql({
         params: { ids: null as never },
         options: { dialect: "sql", format: false },
      });

      expect(result.values).toMatchInlineSnapshot(`[]`);
   });

   test("with template — repeats template per element using each.it()", () => {
      const query = sql`
         VALUES ${each("ids", sql`(${each.it()}, 'x')`, ", ")}
      `;

      const result = query.getSql({
         params: { ids: ["a@test.com", "b@test.com"] },
         options: { dialect: "sql", format: false },
      });

      expect(result.values).toMatchInlineSnapshot(`
        [
          "a@test.com",
          "b@test.com",
        ]
      `);
   });

   test("with SqlQuery template — builds inline", () => {
      const tmpl = sql`(${each.it()}, 'literal')`;
      const query = sql`
         VALUES ${each("ids", tmpl)}
      `;

      const result = query.getSql({
         params: { ids: ["x", "y"] },
         options: { dialect: "sql", format: false },
      });

      expect(result.values).toMatchInlineSnapshot(`
        [
          "x",
          "y",
        ]
      `);
   });

   test("custom separator", () => {
      const query = sql`
         ${each("ids", undefined, " OR id = ")}
      `;

      const result = query.getSql({
         params: { ids: ["a", "b", "c"] },
         options: { dialect: "sql", format: false },
      });

      expect(result.values).toMatchInlineSnapshot(`
        [
          "a",
          "b",
          "c",
        ]
      `);
   });

   test("single element — no separator emitted", () => {
      const query = sql`
         WHERE id IN (${each("ids")})
      `;

      const result = query.getSql({
         params: { ids: ["only-one"] },
         options: { dialect: "sql", format: false },
      });

      expect(result.values).toMatchInlineSnapshot(`
        [
          "only-one",
        ]
      `);
   });
});
