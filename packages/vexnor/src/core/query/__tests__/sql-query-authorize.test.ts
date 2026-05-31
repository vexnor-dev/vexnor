import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";

describe("SqlQuery.authorize", () => {
   test("authorization is null on an untagged query", () => {
      const query = sql`SELECT 1`;
      expect(query.authorization).toBeNull();
   });

   test(".authorize() returns a new object, does not mutate the original", () => {
      const original = sql`SELECT 1`;
      const tagged = original.authorize("admin");
      expect(tagged.authorization).toBe("admin");
      expect(original.authorization).toBeNull();
      expect(tagged).not.toBe(original);
   });

   test(".authorize() replaces the tag when called on an already-tagged query", () => {
      const query = sql`SELECT 1`.authorize("admin").authorize("superuser");
      expect(query.authorization).toBe("superuser");
   });
});
