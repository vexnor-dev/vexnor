import { describe, test, expect } from "vitest";
import { validateParamValue } from "#src/core/query/params/validate-param-value.js";

describe("validateParamValue", () => {
   test("null rules → no errors", () => {
      expect(validateParamValue("anything", null)).toMatchInlineSnapshot(`[]`);
   });

   test("null value → no errors", () => {
      expect(validateParamValue(null, { minLength: 1 })).toMatchInlineSnapshot(`[]`);
   });

   test("minLength — string pass", () => {
      expect(validateParamValue("abc", { minLength: 2 })).toMatchInlineSnapshot(`[]`);
   });

   test("minLength — string fail", () => {
      expect(validateParamValue("a", { minLength: 2 })).toMatchInlineSnapshot(`
        [
          "expected length >= 2",
        ]
      `);
   });

   test("minLength — array", () => {
      expect(validateParamValue([1], { minLength: 2 })).toMatchInlineSnapshot(`
        [
          "expected length >= 2",
        ]
      `);
   });

   test("maxLength — string pass", () => {
      expect(validateParamValue("ab", { maxLength: 5 })).toMatchInlineSnapshot(`[]`);
   });

   test("maxLength — string fail", () => {
      expect(validateParamValue("toolong", { maxLength: 3 })).toMatchInlineSnapshot(`
        [
          "expected length <= 3",
        ]
      `);
   });

   test("pattern — match", () => {
      expect(validateParamValue("abc123", { pattern: /^[a-z0-9]+$/ })).toMatchInlineSnapshot(`[]`);
   });

   test("pattern — mismatch", () => {
      expect(validateParamValue("ABC!", { pattern: /^[a-z]+$/ })).toMatchInlineSnapshot(`
        [
          "pattern mismatch",
        ]
      `);
   });

   test("pattern — non-string value", () => {
      expect(validateParamValue(123, { pattern: /^[a-z]+$/ })).toMatchInlineSnapshot(`
        [
          "pattern mismatch",
        ]
      `);
   });

   test("min — number pass", () => {
      expect(validateParamValue(10, { min: 5 })).toMatchInlineSnapshot(`[]`);
   });

   test("min — number fail", () => {
      expect(validateParamValue(3, { min: 5 })).toMatchInlineSnapshot(`
        [
          "expected value >= 5",
        ]
      `);
   });

   test("min — string pass", () => {
      expect(validateParamValue("b", { min: "a" })).toMatchInlineSnapshot(`[]`);
   });

   test("min — string fail", () => {
      expect(validateParamValue("a", { min: "b" })).toMatchInlineSnapshot(`
        [
          "expected value >= b",
        ]
      `);
   });

   test("min — Date pass", () => {
      const min = new Date("2024-01-01");
      const val = new Date("2024-06-01");
      expect(validateParamValue(val, { min })).toMatchInlineSnapshot(`[]`);
   });

   test("min — Date fail", () => {
      const min = new Date("2024-06-01");
      const val = new Date("2024-01-01");
      expect(validateParamValue(val, { min })).toMatchInlineSnapshot(`
        [
          "expected value >= 2024-06-01T00:00:00.000Z",
        ]
      `);
   });

   test("max — number pass", () => {
      expect(validateParamValue(3, { max: 10 })).toMatchInlineSnapshot(`[]`);
   });

   test("max — number fail", () => {
      expect(validateParamValue(15, { max: 10 })).toMatchInlineSnapshot(`
        [
          "expected value <= 10",
        ]
      `);
   });

   test("max — string pass", () => {
      expect(validateParamValue("a", { max: "z" })).toMatchInlineSnapshot(`[]`);
   });

   test("max — string fail", () => {
      expect(validateParamValue("z", { max: "a" })).toMatchInlineSnapshot(`
        [
          "expected value <= a",
        ]
      `);
   });

   test("max — Date pass", () => {
      const max = new Date("2025-12-31");
      const val = new Date("2025-01-01");
      expect(validateParamValue(val, { max })).toMatchInlineSnapshot(`[]`);
   });

   test("max — Date fail", () => {
      const max = new Date("2024-01-01");
      const val = new Date("2025-01-01");
      expect(validateParamValue(val, { max })).toMatchInlineSnapshot(`
        [
          "expected value <= 2024-01-01T00:00:00.000Z",
        ]
      `);
   });

   test("min — invalid type throws", () => {
      expect(() => validateParamValue(5, { min: true as never })).toThrow("is not a number, string, or Date");
   });

   test("max — invalid type throws", () => {
      expect(() => validateParamValue(5, { max: true as never })).toThrow("is not a number, string, or Date");
   });

   test("values — pass", () => {
      expect(validateParamValue("active", { values: ["active", "inactive"] as const })).toMatchInlineSnapshot(`[]`);
   });

   test("values — fail", () => {
      expect(validateParamValue("unknown", { values: ["active", "inactive"] as const })).toMatchInlineSnapshot(`
        [
          "value not in enum",
        ]
      `);
   });

   test("obj — delegates to validateParamObject", () => {
      const errors = validateParamValue({ badKey: "val" }, { obj: { fieldNames: ["goodKey"] } });
      expect(errors.length).toBeGreaterThan(0);
   });

   test("obj — non-object value", () => {
      expect(validateParamValue("not-an-object", { obj: { fieldNames: ["a"] } })).toMatchInlineSnapshot(`
        [
          "value is expected to be an object because it has object validation rules",
        ]
      `);
   });

   test("getLength — non-string/array throws", () => {
      expect(() => validateParamValue(123, { minLength: 1 })).toThrow("value is not a string or array");
   });
});
