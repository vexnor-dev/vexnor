import { describe, expect, test } from "vitest";
import { quoteText } from "#/core/utils/quote-text.js";
import { parseCallerLocation } from "#/core/utils/caller-location.js";

describe("quoteText — uncovered paths", () => {
   test("does not quote asterisk", () => {
      expect(quoteText("*")).toMatchInlineSnapshot(`"*"`);
   });

   test("quotes simple text", () => {
      expect(quoteText("accounts")).toMatchInlineSnapshot(`""accounts""`);
   });

   test("quotes dotted path", () => {
      expect(quoteText("accounts.email")).toMatchInlineSnapshot(`""accounts"."email""`);
   });

   test("quotes text with 'as' alias", () => {
      expect(quoteText("accounts.email as e")).toMatchInlineSnapshot(`""accounts"."email" as "e""`);
   });

   test("table.* passes through", () => {
      expect(quoteText("accounts.*")).toMatchInlineSnapshot(`""accounts".*"`);
   });

   test("already quoted text is not double-quoted", () => {
      expect(quoteText(`"accounts"`)).toMatchInlineSnapshot(`""accounts""`);
   });
});

describe("parseCallerLocation — uncovered paths", () => {
   test("returns null for undefined stack", () => {
      expect(parseCallerLocation(undefined, "file:///some/path/src/core/query/sql-query.ts")).toMatchInlineSnapshot(`
        {
          "location": null,
          "locationUrl": null,
        }
      `);
   });

   test("returns null for empty stack", () => {
      expect(parseCallerLocation("", "file:///some/path/src/core/query/sql-query.ts")).toMatchInlineSnapshot(`
        {
          "location": null,
          "locationUrl": null,
        }
      `);
   });

   test("parses a user-level location from stack", () => {
      const stack = `Error
    at new SqlQuery (/Users/test/project/packages/vexnor/src/core/query/sql-query.ts:105:10)
    at sql (/Users/test/project/packages/vexnor/src/core/sql.ts:50:10)
    at Object.<anonymous> (/Users/test/project/app/src/queries.ts:10:5)`;
      const result = parseCallerLocation(stack, "file:///Users/test/project/packages/vexnor/src/core/query/sql-query.ts");
      expect(result.location).toBeDefined();
      expect(result.locationUrl).toBeDefined();
   });

   test("returns null when only internal frames", () => {
      const stack = `Error
    at new SqlQuery (/Users/test/project/packages/vexnor/src/core/query/sql-query.ts:105:10)
    at sql (/Users/test/project/packages/vexnor/src/core/sql.ts:50:10)`;
      const result = parseCallerLocation(stack, "file:///Users/test/project/packages/vexnor/src/core/query/sql-query.ts");
      expect(result.location).toBeNull();
   });
});
