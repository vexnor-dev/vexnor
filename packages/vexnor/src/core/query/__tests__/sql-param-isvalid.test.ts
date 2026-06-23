import { describe, expect, test } from "vitest";
import { param } from "#/core/query/sql-param.js";

import { validateParamValue } from "#/core/query/params/validate-param-value.js";

describe("validateParamValue", () => {
   test("returns empty array when valid", () => {
      expect(validateParamValue("hello@x.com", param<{ s: string }>("s", { minLength: 3, pattern: /@/ }).validation)).toMatchInlineSnapshot(`[]`);
   });

   test("returns all failures when multiple rules fail", () => {
      expect(validateParamValue("x", param<{ s: string }>("s", { minLength: 3, pattern: /@/ }).validation)).toMatchInlineSnapshot(`
         [
           "expected length >= 3",
           "pattern mismatch",
         ]
      `);
   });

   test("includes pattern failure alongside other failures", () => {
      expect(
         validateParamValue(
            "x",
            param<{ s: string }>("s", {
               minLength: 3,
               pattern: /^acc_/,
            }).validation,
         ),
      ).toMatchInlineSnapshot(`
         [
           "expected length >= 3",
           "pattern mismatch",
         ]
      `);
   });

   test("returns empty array for null regardless of rules", () => {
      expect(validateParamValue(null, param<{ s: string }>("s", { minLength: 3, pattern: /@/ }).validation)).toMatchInlineSnapshot(`[]`);
   });

   test("returns empty array when no validation", () => {
      expect(validateParamValue("anything", null)).toMatchInlineSnapshot(`[]`);
   });
});

describe("SqlParam.isValid", () => {
   test("returns true when no validation is set", () => {
      const p = param<{ x: string }>("x");
      expect(p.isValid("anything")).toBe(true);
      expect(p.isValid(null)).toBe(true);
   });

   test("minLength / maxLength", () => {
      const p = param<{ s: string }>("s", { minLength: 3, maxLength: 6 });
      expect(p.isValid("ab")).toBe(false);
      expect(p.isValid("abc")).toBe(true);
      expect(p.isValid("abcdef")).toBe(true);
      expect(p.isValid("abcdefg")).toBe(false);
   });

   test("pattern", () => {
      const p = param<{ email: string }>("email", { pattern: /@/ });
      expect(p.isValid("nope")).toBe(false);
      expect(p.isValid("a@b.c")).toBe(true);
   });

   test("min / max (number)", () => {
      const p = param<{ n: number }>("n", { min: 1, max: 10 });
      expect(p.isValid(0)).toBe(false);
      expect(p.isValid(1)).toBe(true);
      expect(p.isValid(10)).toBe(true);
      expect(p.isValid(11)).toBe(false);
   });

   test("min / max (Date)", () => {
      const lo = new Date("2020-01-01");
      const hi = new Date("2025-01-01");
      const p = param<{ d: Date }>("d", { min: lo, max: hi });
      expect(p.isValid(new Date("2019-12-31"))).toBe(false);
      expect(p.isValid(new Date("2022-06-15"))).toBe(true);
      expect(p.isValid(new Date("2025-06-01"))).toBe(false);
   });

   test("enum", () => {
      const p = param<{ role: string }>("role", { values: ["admin", "user"] as const });
      expect(p.isValid("admin")).toBe(true);
      expect(p.isValid("guest")).toBe(false);
   });

   test("values whitelist", () => {
      const p = param<{ sort: string }>("sort", { values: ["asc", "desc"] as const });
      expect(p.isValid("asc")).toBe(true);
      expect(p.isValid("desc")).toBe(true);
      expect(p.isValid("random")).toBe(false);
   });

   test("custom validate — boolean", () => {
      const p = param<{ id: string }>("id", { pattern: /^acc_/ });
      expect(p.isValid("acc_123")).toBe(true);
      expect(p.isValid("123")).toBe(false);
   });

   test("custom validate — string message", () => {
      const p = param<{ id: string }>("id", { pattern: /^acc_/ });
      expect(p.isValid("acc_ok")).toBe(true);
      expect(p.isValid("nope")).toBe(false);
   });
});

describe("SqlParam.valueOrDefault", () => {
   test("undefined returns declared default", () => {
      const p = param<{ sort: string }>("sort", { default: "createdAt" });
      expect(p.valueOrDefault(undefined)).toBe("createdAt");
   });

   test("undefined returns undefined when no default declared", () => {
      const p = param<{ sort: string }>("sort");
      expect(p.valueOrDefault(undefined)).toBeUndefined();
   });

   test("valid value is returned as-is", () => {
      const p = param<{ sort: string }>("sort", { values: ["asc", "desc"], default: "asc" });
      expect(p.valueOrDefault("desc")).toBe("desc");
   });

   test("null is returned as-is — not replaced by default", () => {
      const p = param<{ sort: string }>("sort", { default: "createdAt" });
      expect(p.valueOrDefault(null)).toBeNull();
   });

   test("invalid value + default declared returns default silently", () => {
      const p = param<{ sort: string }>("sort", { values: ["asc", "desc"], default: "asc" });
      expect(p.valueOrDefault("random")).toBe("asc");
   });

   test("invalid value + no default throws", () => {
      const p = param<{ sort: string }>("sort", { values: ["asc", "desc"] });
      expect(() => p.valueOrDefault("random")).toThrow("Invalid param 'sort'");
   });

   test("no validation + undefined returns undefined", () => {
      const p = param<{ x: string }>("x");
      expect(p.valueOrDefault(undefined)).toBeUndefined();
   });
});

describe("SqlParam.validOrDefault", () => {
   test("returns value when valid", () => {
      const p = param<{ s: string }>("s", { minLength: 3 });
      expect(p.validOrDefault("hello", "fallback")).toBe("hello");
   });

   test("returns default when invalid", () => {
      const p = param<{ s: string }>("s", { minLength: 3 });
      expect(p.validOrDefault("hi", "fallback")).toBe("fallback");
   });

   test("returns value when no validation", () => {
      const p = param<{ x: string }>("x");
      expect(p.validOrDefault("anything", "default")).toBe("anything");
   });

   test("null skips validation and is returned as-is", () => {
      const p = param<{ s: string }>("s", { minLength: 3 });
      expect(p.validOrDefault(null, "fallback")).toBeNull();
   });

   test("values whitelist", () => {
      const p = param<{ sort: string }>("sort", { values: ["asc", "desc"] as const });
      expect(p.validOrDefault("asc", "asc")).toBe("asc");
      expect(p.validOrDefault("random", "asc")).toBe("asc");
   });
});
