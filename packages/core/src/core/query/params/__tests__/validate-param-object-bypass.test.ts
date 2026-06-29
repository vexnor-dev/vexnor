import { describe, expect, test } from "vitest";
import { validateParamObject } from "#src/core/query/params/validate-param-object.js";

describe("validateParamObject — dot-notation bypass", () => {
   describe("P1: any key containing a dot bypasses allowedKeys validation", () => {
      test("dot-notation key bypasses column validation (non-array mode)", () => {
         const errors: string[] = [];
         // "x.y" is not in allowedKeys but passes because it contains a dot
         validateParamObject(
            { "x.y": "someValue" },
            { fieldNames: ["email", "status"], operators: { "=": { args: 1 } } },
            errors,
         );
         // Should have an error since "x.y" is not a valid column, but doesn't
         expect(errors).toMatchInlineSnapshot(`
           [
             "Column key 'x.y' not allowed in: [object Set]",
           ]
         `);
      });

      test("arbitrary dot-notation key in filterBy context passes validation", () => {
         const errors: string[] = [];
         // Simulates a crafted filterBy param with invented dot-notation keys
         validateParamObject(
            { "invented.table.column": ["like", "%injection%"] },
            { fieldNames: ["email", "status"], operators: { like: { args: 1 } } },
            errors,
         );
         expect(errors).toMatchInlineSnapshot(`
           [
             "Column key 'invented.table.column' not allowed in: [object Set]",
           ]
         `);
      });

      test("dot-notation inside OR group also bypasses", () => {
         const errors: string[] = [];
         validateParamObject(
            { or: [{ "nonexistent.col": "value" }] },
            { fieldNames: ["email", "status"], operators: { "=": { args: 1 } } },
            errors,
         );
         expect(errors).toMatchInlineSnapshot(`
           [
             "Column key 'nonexistent.col' not allowed in: [object Set]",
           ]
         `);
      });

      test("legitimate non-dot key IS correctly rejected", () => {
         const errors: string[] = [];
         validateParamObject(
            { invalidColumn: "value" },
            { fieldNames: ["email", "status"], operators: { "=": { args: 1 } } },
            errors,
         );
         // This correctly produces an error
         expect(errors).toMatchInlineSnapshot(`
           [
             "Column key 'invalidColumn' not allowed in: [object Set]",
           ]
         `);
      });

      test("object-valued key also bypasses regardless of dot", () => {
         const errors: string[] = [];
         // When propValue is a non-null, non-array object, key validation is entirely skipped
         validateParamObject(
            { arbitraryKey: { nested: "value" } },
            { fieldNames: ["email", "status"], operators: { "=": { args: 1 } } },
            errors,
         );
         // Should reject "arbitraryKey" but doesn't because of the typeof check
         expect(errors).toMatchInlineSnapshot(`[]`);
      });
   });
});
