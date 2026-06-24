import { describe, test, expect } from "vitest";
import { sql } from "#/core/sql.js";
import { eachObject, eachKey, eachValue, colInTable } from "#/core/operators/sql-each-object.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

describe("eachObject", () => {
   test("iterates over object entries emitting key = value pairs", () => {
      const query = sql`UPDATE ${Account} SET ${eachObject<{ set: Record<string, unknown> }>("set", sql`${eachKey()} = ${eachValue()}`.inline())}`;
      const { text, values } = query.getSql({ params: { set: { email: "new@test.com", firstName: "Jane" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        UPDATE "main"."account"
        SET
          /* <query_1> */ "email" = ? /* </query_1> */,
          /* <query_1> */ "firstName" = ? /* </query_1> */ /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "new@test.com",
          "Jane",
        ]
      `);
   });

   test("with colInTable gate — skips invalid keys", () => {
      const template = colInTable(Account, eachKey(), sql`${eachKey()} = ${eachValue()}`.inline());
      const query = sql`SET ${eachObject<{ set: Record<string, unknown> }>("set", template)}`;
      const { text, values } = query.getSql({ params: { set: { email: "a@b.com", notAColumn: "skip" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SET
          /* <query_1> */ "email" = ? /* </query_1> */ /* </query_0> */"
      `);
      expect(values).toMatchInlineSnapshot(`
        [
          "a@b.com",
        ]
      `);
   });

   test("empty object — emits nothing", () => {
      const query = sql`SET ${eachObject<{ set: Record<string, unknown> }>("set", sql`${eachKey()} = ${eachValue()}`.inline())}`;
      const { text } = query.getSql({ params: { set: {} } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SET
          /* </query_0> */"
      `);
   });

   test("null param — emits nothing", () => {
      const query = sql`SET ${eachObject<{ set: Record<string, unknown> }>("set", sql`${eachKey()} = ${eachValue()}`.inline())}`;
      const { text } = query.getSql({ params: { set: null as never } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SET
          /* </query_0> */"
      `);
   });

   test("custom separator", () => {
      const query = sql`${eachObject<{ set: Record<string, unknown> }>("set", sql`${eachKey()} = ${eachValue()}`.inline(), " AND ")}`;
      const { text } = query.getSql({ params: { set: { email: "a", firstName: "b" } } });
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */ /* <query_1> */ "email" = ? /* </query_1> */
        AND /* <query_1> */ "firstName" = ? /* </query_1> */ /* </query_0> */"
      `);
   });
});
