import { describe, expect, test } from "vitest";
import { MssqlTokenizer } from "#src/mssql-tokenizer.js";

const tokenizer = new MssqlTokenizer();

describe("MssqlTokenizer — branch coverage", () => {
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

   test("handles unclosed quote", () => {
      const result = tokenizer.tokenize("SELECT 'unclosed");
      expect(result).toMatchInlineSnapshot(`
        [
          "select",
        ]
      `);
   });

   test("allows @ parameter marker (MSSQL uses @)", () => {
      const result = tokenizer.tokenize("SELECT @param FROM t");
      expect(result).toContain("@");
   });

   test("allows $ marker", () => {
      const result = tokenizer.tokenize("SELECT $ FROM t");
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
      const result = tokenizer.tokenize("TOP 10");
      expect(result).toMatchInlineSnapshot(`
        [
          "top",
          "10",
        ]
      `);
   });

   test("operator tokens (>=)", () => {
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
