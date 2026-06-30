import { describe, test, expect } from "vitest";
import { validateParamObject } from "#src/core/query/params/validate-param-object.js";

describe("validateParamObject — array input branch", () => {
   test("validates array entries against fieldNames — valid entries pass", () => {
      const errors: string[] = [];
      validateParamObject(
         ["email", "status"] as unknown as Record<string, unknown>,
         { fieldNames: ["email", "status", "accountId"], operators: {} },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });

   test("validates array entries against fieldNames — invalid entry rejected", () => {
      const errors: string[] = [];
      validateParamObject(
         ["email", "badColumn"] as unknown as Record<string, unknown>,
         { fieldNames: ["email", "status"], operators: {} },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`
        [
          "Column 'badColumn' not allowed in: [object Set]",
        ]
      `);
   });

   test("validates array with aggregates included in allowedKeys", () => {
      const errors: string[] = [];
      validateParamObject(
         ["email", "count"] as unknown as Record<string, unknown>,
         { fieldNames: ["email"], aggregates: ["count", "sum"], operators: {} },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });

   test("skips tuple entries (aggregation) in array", () => {
      const errors: string[] = [];
      validateParamObject(
         ["email", ["count", "*", "total"]] as unknown as Record<string, unknown>,
         { fieldNames: ["email"], aggregates: ["count"], operators: {} },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });

   test("null fieldNames — skips key validation for array entries", () => {
      const errors: string[] = [];
      validateParamObject(
         ["anything", "goes"] as unknown as Record<string, unknown>,
         { fieldNames: null as unknown as string[], operators: {} },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });
});
