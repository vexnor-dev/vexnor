import { describe, expect, test } from "vitest";
import { PostgresTokenizer } from "#/postgres-tokenizer.js";

const tokenizer = new PostgresTokenizer("test_query");

describe("PostgresTokenizer — branch coverage", () => {
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

   test("skips double-quoted identifiers", () => {
      const result = tokenizer.tokenize('SELECT "my_col" FROM t');
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
          "from",
          "t",
        ]
      `);
   });

   test("skips dollar-quoted strings ($$...$$)", () => {
      const result = tokenizer.tokenize("SELECT $$ body $$ FROM t");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
          "from",
          "t",
        ]
      `);
   });

   test("handles unclosed single quote", () => {
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

   test("throws on $ parameter marker ($1)", () => {
      expect(() => tokenizer.tokenize("SELECT $1")).toThrow("forbidden parameter characters");
   });

   test("handles ? operator (JSONB)", () => {
      const result = tokenizer.tokenize("SELECT * FROM t WHERE data ? 'key'");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
          "*",
          "from",
          "t",
          "where",
          "data",
          "?",
        ]
      `);
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
      const result = tokenizer.tokenize("SELECT 42 FROM t");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
          "42 ",
          "from",
          "t",
        ]
      `);
   });

   test("operator tokens (>=, !=)", () => {
      const result = tokenizer.tokenize("SELECT * FROM t WHERE x >= 1");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
          "*",
          "from",
          "t",
          "where",
          "x",
          ">=",
          "1",
        ]
      `);
   });
});
