import { describe, test, expect } from "vitest";
import { validateParamObject } from "#src/core/query/params/validate-param-object.js";

describe("validateParamObject", () => {
   test("valid keys and values — no errors", () => {
      const errors: string[] = [];
      validateParamObject(
         { email: ["like", "%@test.com"] },
         { fieldNames: ["email", "status"], operators: { like: { args: 1 } }, fieldValues: ["like", "="] },
         errors,
      );
      expect(errors).toMatchInlineSnapshot(`
        [
          "Column 'email':'like,%@test.com' value not allowed in: [object Set]",
        ]
      `);
   });

   test("invalid key — error", () => {
      const errors: string[] = [];
      validateParamObject(
         { badCol: "value" },
         { fieldNames: ["email", "status"] },
         errors,
      );
      expect(errors.length).toBeGreaterThan(0);
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
      expect(errors).toMatchInlineSnapshot(`
        [
          "Column 'email':'like,%@vip.com' value not allowed in: [object Set]",
        ]
      `);
   });

   test("or key — invalid inner key reports error", () => {
      const errors: string[] = [];
      validateParamObject(
         { or: [{ badCol: "value" }] },
         { fieldNames: ["email"] },
         errors,
      );
      expect(errors.length).toBeGreaterThan(0);
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
