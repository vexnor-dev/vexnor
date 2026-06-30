import { describe, expect, test } from "vitest";
import { Sqlite3Tokenizer } from "#src/sqlite3-tokenizer.js";

const tokenizer = new Sqlite3Tokenizer();

describe("Sqlite3Tokenizer — branch coverage", () => {
   test("skips line comments (--)", () => {
      const result = tokenizer.tokenize("SELECT -- comment\n* FROM t");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
          "*",
          "from",
          "t",
        ]
      `);
   });

   test("skips line comment at end (no newline)", () => {
      const result = tokenizer.tokenize("SELECT * -- trailing");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
          "*",
        ]
      `);
   });

   test("skips block comments (/* */)", () => {
      const result = tokenizer.tokenize("SELECT /* comment */ * FROM t");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
          "*",
          "from",
          "t",
        ]
      `);
   });

   test("handles unclosed block comment", () => {
      const result = tokenizer.tokenize("SELECT /* never closed");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
        ]
      `);
   });

   test("skips single-quoted strings", () => {
      const result = tokenizer.tokenize("SELECT * FROM t WHERE name = 'hello'");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
          "*",
          "from",
          "t",
          "where",
          "name",
          "=",
        ]
      `);
   });

   test("skips backtick-quoted identifiers", () => {
      const result = tokenizer.tokenize("SELECT `my_col` FROM t");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
          "from",
          "t",
        ]
      `);
   });

   test("handles unclosed quote", () => {
      const result = tokenizer.tokenize("SELECT 'unclosed");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
        ]
      `);
   });

   test("throws on @ parameter marker", () => {
      expect(() => tokenizer.tokenize("SELECT @param")).toThrow("forbidden parameter characters");
   });

   test("allows ? parameter marker", () => {
      const result = tokenizer.tokenize("SELECT * FROM t WHERE id = ?");
      expect(result).toContain("?");
   });

   test("allows $ parameter marker", () => {
      const result = tokenizer.tokenize("SELECT * FROM t WHERE $");
      expect(result).toContain("$");
   });

   test("keyword at end of string (exact length match)", () => {
      const result = tokenizer.tokenize("select");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
        ]
      `);
   });

   test("numeric tokens", () => {
      const result = tokenizer.tokenize("LIMIT 10");
      expect(result).toMatchInlineSnapshot(`
        [
          "limit",
          "10",
        ]
      `);
   });

   test("operator tokens", () => {
      const result = tokenizer.tokenize("WHERE x >= 1");
      expect(result).toMatchInlineSnapshot(`
        [
          "where",
          "x",
          ">=",
          "1",
        ]
      `);
   });
});
