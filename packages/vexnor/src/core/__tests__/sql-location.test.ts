import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";

describe("sql location", () => {
   test("location is a string or null — never undefined", () => {
      const query = sql`SELECT 1`;
      expect(query.location === null || typeof query.location === "string").toBe(true);
   });

   test(".authorize() preserves location from original query", () => {
      const query = sql`SELECT 1`;
      const tagged = query.authorize("admin");
      expect(tagged.location).toBe(query.location);
   });
});
