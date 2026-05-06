import { describe, expect, test } from "vitest";
import { detectQueryType } from "#/cli/exec/detect-query-type.js";

describe("detectQueryType", () => {
   test("detects SELECT queries", () => {
      expect(detectQueryType("SELECT * FROM users")).toBe("select");
      expect(detectQueryType("  SELECT id FROM accounts")).toBe("select");
      expect(detectQueryType("WITH cte AS (SELECT 1) SELECT * FROM cte")).toBe("select");
   });

   test("detects mutation queries", () => {
      expect(detectQueryType("INSERT INTO users VALUES (1)")).toBe("mutation");
      expect(detectQueryType("UPDATE users SET name = 'test'")).toBe("mutation");
      expect(detectQueryType("DELETE FROM users WHERE id = 1")).toBe("mutation");
      expect(detectQueryType("  MERGE INTO users")).toBe("mutation");
      expect(detectQueryType("UPSERT INTO users")).toBe("mutation");
   });

   test("detects destructive queries", () => {
      expect(detectQueryType("DROP TABLE users")).toBe("destructive");
      expect(detectQueryType("TRUNCATE TABLE users")).toBe("destructive");
      expect(detectQueryType("ALTER TABLE users ADD COLUMN")).toBe("destructive");
      expect(detectQueryType("  DROP DATABASE test")).toBe("destructive");
   });

   test("is case insensitive", () => {
      expect(detectQueryType("insert into users")).toBe("mutation");
      expect(detectQueryType("drop table users")).toBe("destructive");
   });
});
