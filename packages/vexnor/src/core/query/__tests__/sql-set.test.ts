import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { set } from "#/core/operators/sql-set.js";
import { param } from "#/core/query/sql-param.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

type UpdateParams = { set: Record<string, unknown>; accountId: string };

describe("SqlSet", () => {
   test("emits SET col = val pairs for multiple keys", () => {
      const query = sql`
         UPDATE ${Account}
         ${set(Account)}
         WHERE ${Account.$accountId} = ${param<UpdateParams>("accountId")}
      `;

      const result = query.getSql({
         params: { set: { email: "jane@example.com", firstName: "Jane" }, accountId: "123" },
         options: { dialect: "sql", format: false },
      });

      expect(result.text).toMatchInlineSnapshot(`
        " /* <query_0> */ 
                 UPDATE "main"."account"
                 set "email" = ?, "first_name" = ?
                 WHERE "account"."account_id" = ?
              /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          "jane@example.com",
          "Jane",
          "123",
        ]
      `);
   });

   test("handles single key", () => {
      const query = sql`
         UPDATE ${Account}
         ${set(Account)}
         WHERE ${Account.$accountId} = ${param<UpdateParams>("accountId")}
      `;

      const result = query.getSql({
         params: { set: { email: "updated@test.com" }, accountId: "456" },
         options: { dialect: "sql", format: false },
      });

      expect(result.text).toMatchInlineSnapshot(`
        " /* <query_0> */ 
                 UPDATE "main"."account"
                 set "email" = ?
                 WHERE "account"."account_id" = ?
              /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          "updated@test.com",
          "456",
        ]
      `);
   });

   test("handles many keys — all get comma-separated", () => {
      const query = sql`
         UPDATE ${Account}
         ${set(Account)}
         WHERE ${Account.$accountId} = ${param<UpdateParams>("accountId")}
      `;

      const result = query.getSql({
         params: { set: { email: "new@test.com", firstName: "New", lastName: "User", notes: "note" }, accountId: "789" },
         options: { dialect: "sql", format: false },
      });

      expect(result.text).toMatchInlineSnapshot(`
        " /* <query_0> */ 
                 UPDATE "main"."account"
                 set "email" = ?, "first_name" = ?, "last_name" = ?, "notes" = ?
                 WHERE "account"."account_id" = ?
              /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          "new@test.com",
          "New",
          "User",
          "note",
          "789",
        ]
      `);
   });

   test("handles null values", () => {
      const query = sql`
         UPDATE ${Account}
         ${set(Account)}
         WHERE ${Account.$accountId} = ${param<UpdateParams>("accountId")}
      `;

      const result = query.getSql({
         params: { set: { notes: null }, accountId: "123" },
         options: { dialect: "sql", format: false },
      });

      expect(result.text).toMatchInlineSnapshot(`
        " /* <query_0> */ 
                 UPDATE "main"."account"
                 set "notes" = ?
                 WHERE "account"."account_id" = ?
              /* </query_0> */"
      `);
      expect(result.values).toMatchInlineSnapshot(`
        [
          null,
          "123",
        ]
      `);
   });

   test("throws on unknown column", () => {
      const query = sql`
         UPDATE ${Account}
         ${set(Account)}
         WHERE ${Account.$accountId} = ${param<UpdateParams>("accountId")}
      `;

      expect(() =>
         query.getSql({
            params: { set: { notAColumn: "value" }, accountId: "123" },
            options: { dialect: "sql", format: false },
         }),
      ).toThrow("Column not found: notAColumn");
   });

   test("throws on non-primitive value", () => {
      const query = sql`
         UPDATE ${Account}
         ${set(Account)}
         WHERE ${Account.$accountId} = ${param<UpdateParams>("accountId")}
      `;

      expect(() =>
         query.getSql({
            params: { set: { email: { nested: true } } as never, accountId: "123" },
            options: { dialect: "sql", format: false },
         }),
      ).toThrow("not a primitive");
   });

});
