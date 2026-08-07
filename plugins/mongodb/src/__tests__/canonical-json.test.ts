import { describe, it, expect } from "vitest";
import { canonicalJson } from "#src/canonical-json.js";

describe("canonicalJson", () => {
   it("produces sorted keys for deterministic output", () => {
      const obj1 = { b: 1, a: 2, c: 3 };
      const obj2 = { c: 3, a: 2, b: 1 };

      expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
   });

   it("handles nested objects with sorted keys", () => {
      const result = canonicalJson({ z: { b: 1, a: 2 }, y: "hello" });
      expect(result).toMatchInlineSnapshot(`"{"y":"hello","z":{"a":2,"b":1}}"`);
   });

   it("handles arrays (preserves order)", () => {
      const result = canonicalJson([3, 1, 2]);
      expect(result).toMatchInlineSnapshot(`"[3,1,2]"`);
   });

   it("handles null and undefined", () => {
      expect(canonicalJson(null)).toMatchInlineSnapshot(`"null"`);
      expect(canonicalJson(undefined)).toMatchInlineSnapshot(`undefined`);
   });

   it("handles primitives", () => {
      expect(canonicalJson("hello")).toMatchInlineSnapshot(`""hello""`);
      expect(canonicalJson(42)).toMatchInlineSnapshot(`"42"`);
      expect(canonicalJson(true)).toMatchInlineSnapshot(`"true"`);
   });

   it("handles deeply nested objects with consistent ordering", () => {
      const deep1 = { a: { c: { e: 1, d: 2 }, b: 3 } };
      const deep2 = { a: { b: 3, c: { d: 2, e: 1 } } };

      expect(canonicalJson(deep1)).toBe(canonicalJson(deep2));
   });

   it("handles Date objects as ISO strings", () => {
      const date = new Date("2024-06-15T12:00:00.000Z");
      const result = canonicalJson({ createdAt: date });
      expect(result).toMatchInlineSnapshot(`"{"createdAt":"2024-06-15T12:00:00.000Z"}"`);
   });

   it("handles mixed arrays and objects", () => {
      const result = canonicalJson({
         filter: { status: "shipped" },
         pipeline: [{ $match: { active: true } }, { $group: { _id: "$country" } }],
      });
      expect(result).toMatchInlineSnapshot(
         `"{"filter":{"status":"shipped"},"pipeline":[{"$match":{"active":true}},{"$group":{"_id":"$country"}}]}"`,
      );
   });
});
