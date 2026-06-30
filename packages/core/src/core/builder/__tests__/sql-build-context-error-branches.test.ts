import { describe, expect, test } from "vitest";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { sql } from "#src/core/sql.js";

describe("SqlBuildContext — uncovered error branches", () => {
   test("scope with invalid queryType throws", () => {
      const query = sql`SELECT 1`;
      const context = new SqlBuildContext({ dialect: "sql" });
      expect(() =>
         context.scope(query, () => {}, { queryType: "invalid" as never }),
      ).toThrow("Unknown query type: invalid");
   });

   test("addQuotes adds properly quoted text tokens", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.addQuotes("hello", "world");
      expect(context.text).toMatchInlineSnapshot(`""hello""world""`);
   });

   test("tokens getter returns frozen array", () => {
      const context = new SqlBuildContext({ dialect: "sql" });
      context.addStrings("SELECT 1");
      const tokens = context.tokens;
      expect(Object.isFrozen(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
   });
});
