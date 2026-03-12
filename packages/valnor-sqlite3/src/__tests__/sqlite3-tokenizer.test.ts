import { describe, expect, test } from "vitest";
import { Sqlite3Tokenizer } from "#/sqlite3-tokenizer.js";

describe("sqlite3 tokenizer tests", () => {
   test("should tokenize basic queries", () => {
      const tokenizer = new Sqlite3Tokenizer();
      const result = tokenizer.tokenize("SELECT * FROM users WHERE id = ?");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
          "*",
          "from",
          "users",
          "where",
          "id",
          "=",
          "?",
        ]
      `);
   });

   test("should handle parameter substitution", () => {
      const tokenizer = new Sqlite3Tokenizer();
      const result = tokenizer.tokenize("INSERT INTO users (name, email) VALUES (?, ?)");
      expect(result).toMatchInlineSnapshot(`
        [
          "insert into",
          "users",
          "(",
          "name",
          ",",
          "email",
          ")",
          "values",
          "(",
          "?",
          ",",
          "?",
          ")",
        ]
      `);
   });

   test("should handle multiple parameters", () => {
      const tokenizer = new Sqlite3Tokenizer();
      const result = tokenizer.tokenize("UPDATE users SET name = ?, email = ? WHERE id = ?");
      expect(result).toMatchInlineSnapshot(`
        [
          "update",
          "users",
          "set",
          "name",
          "=",
          "?",
          ",",
          "email",
          "=",
          "?",
          "where",
          "id",
          "=",
          "?",
        ]
      `);
   });
});
