import { describe, test, expect } from "vitest";
import { validateParamObject } from "#src/core/query/params/validate-param-object.js";

describe("validateParamObject — array input branch", () => {
   test("array with fieldValues — valid entries pass", () => {
      const errors: string[] = [];
      validateParamObject(
         ["ASC", "DESC"] as unknown as Record<string, unknown>,
         { fieldValues: ["ASC", "DESC", "asc", "desc"] },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });

   test("array with fieldValues — invalid entry rejected", () => {
      const errors: string[] = [];
      validateParamObject(
         ["ASC", "INVALID"] as unknown as Record<string, unknown>,
         { fieldValues: ["ASC", "DESC", "asc", "desc"] },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`
        [
          "Column 'INVALID' not allowed in: [object Set]",
        ]
      `);
   });

   test("array with fieldValues and aggregates — aggregates included in allowed set", () => {
      const errors: string[] = [];
      validateParamObject(
         ["ASC", "count"] as unknown as Record<string, unknown>,
         { fieldValues: ["ASC", "DESC"], aggregates: ["count", "sum"] },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });

   test("array with fieldNames — valid entries pass", () => {
      const errors: string[] = [];
      validateParamObject(
         ["email", "status"] as unknown as Record<string, unknown>,
         { fieldNames: ["email", "status", "createdAt"] },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });

   test("array with fieldNames — invalid entry rejected", () => {
      const errors: string[] = [];
      validateParamObject(
         ["email", "badColumn"] as unknown as Record<string, unknown>,
         { fieldNames: ["email", "status"] },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`
        [
          "Column 'badColumn' not allowed in: [object Set]",
        ]
      `);
   });

   test("array with neither fieldNames nor fieldValues — no validation", () => {
      const errors: string[] = [];
      validateParamObject(
         ["anything", "goes"] as unknown as Record<string, unknown>,
         { operators: { "=": { args: 1 } } },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });

   test("array with non-string entries — skipped", () => {
      const errors: string[] = [];
      validateParamObject(
         ["email", 123, ["count", "*", "total"]] as unknown as Record<string, unknown>,
         { fieldNames: ["email"] },
         errors,
      );
      // Only "email" is validated as a string; 123 and the tuple are skipped
      expect(errors).toMatchInlineSnapshot(`[]`);
   });
});

describe("validateParamObject", () => {
   test("valid keys and values — no errors", () => {
      const errors: string[] = [];
      validateParamObject(
         { email: ["like", "%@test.com"] },
         { fieldNames: ["email", "status"], operators: { like: { args: 1 } }, fieldValues: ["like", "="] },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });

   test("invalid key — rejected for non-dot keys", () => {
      const errors: string[] = [];
      validateParamObject(
         { badCol: "value" },
         { fieldNames: ["email", "status"], operators: { "=": { args: 1 } } },
         errors,
      );
      expect(errors.length).toBe(1);
   });

   test("invalid value when fieldValues set — error", () => {
      const errors: string[] = [];
      validateParamObject(
         { email: "invalidOp" },
         { fieldNames: ["email"], fieldValues: ["like", "="], operators: { like: { args: 1 }, "=": { args: 1 } } },
         errors,
      );
      expect(errors.length).toBeGreaterThan(0);
   });

   test("null fieldValues — value check skipped", () => {
      const errors: string[] = [];
      validateParamObject(
         { email: "anything" },
         { fieldNames: ["email"], fieldValues: null },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });

   test("or key — flattens and validates inner entries", () => {
      const errors: string[] = [];
      validateParamObject(
         { or: [{ email: ["like", "%@vip.com"] }, { status: "active" }] },
         { fieldNames: ["email", "status"], operators: { like: { args: 1 } }, fieldValues: ["like", "active"] },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });

   test("or key — invalid inner key rejected for non-dot keys", () => {
      const errors: string[] = [];
      validateParamObject(
         { or: [{ badCol: "value" }] },
         { fieldNames: ["email"], operators: { "=": { args: 1 } } },
         errors,
      );
      expect(errors.length).toBe(1);
   });

   test("invalid operator — error", () => {
      const errors: string[] = [];
      validateParamObject(
         { email: ["unknownOp", "val"] },
         { fieldNames: ["email"], operators: { like: { args: 1 } } },
         errors,
      );
      expect(errors).toContainEqual(expect.stringContaining("invalid operator"));
   });

   test("variadic operator with 0 args — error", () => {
      const errors: string[] = [];
      validateParamObject(
         { status: ["in"] },
         { fieldNames: ["status"], operators: { in: { args: "variadic" } } },
         errors,
      );
      expect(errors).toContainEqual(expect.stringContaining("requires at least 1 argument"));
   });

   test("fixed arity mismatch — error", () => {
      const errors: string[] = [];
      validateParamObject(
         { email: ["like", "a", "b"] },
         { fieldNames: ["email"], operators: { like: { args: 1 } } },
         errors,
      );
      expect(errors).toContainEqual(expect.stringContaining("expects 1 argument(s), got 2"));
   });

   test("valid operator with correct arity — no error", () => {
      const errors: string[] = [];
      validateParamObject(
         { createdAt: ["between", "2024-01-01", "2024-12-31"] },
         { fieldNames: ["createdAt"], operators: { between: { args: 2 } } },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });

   test("aggregates extend allowedKeys", () => {
      const errors: string[] = [];
      validateParamObject(
         { count: "value" },
         { fieldNames: ["email"], aggregates: ["count", "sum"] },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`[]`);
   });
});
