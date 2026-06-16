import { describe, expect, test } from "vitest";
import { trim } from "#/core/utils/trim.js";
import { findQueryComment } from "#/core/utils/find-query-comment.js";
import { getCanonicalInsertKeys } from "#/core/utils/canonical-insert-keys.js";
import { deserialize } from "#/core/utils/sql-json-schema.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";

describe("trim — uncovered paths", () => {
   test("trim with template string", () => {
      const result = trim`  SELECT  *  FROM   accounts  `;
      expect(result).toMatchInlineSnapshot(`"SELECT * FROM accounts"`);
   });

   test("trim normalizes parentheses spacing", () => {
      const result = trim`( a, b )`;
      expect(result).toMatchInlineSnapshot(`"(a, b)"`);
   });

   test("trim throws when values are provided", () => {
      expect(() => (trim as Function)("test", "value")).toThrow("Values not expected");
   });
});

describe("findQueryComment — uncovered paths", () => {
   test("returns undefined when no comment", () => {
      expect(findQueryComment(["SELECT * FROM accounts"])).toBeUndefined();
   });

   test("returns comment content", () => {
      expect(findQueryComment(["/* my-query */ SELECT 1"])).toMatchInlineSnapshot(`"my-query"`);
   });

   test("returns undefined for unclosed comment", () => {
      expect(findQueryComment(["/* unclosed"])).toBeUndefined();
   });

   test("returns undefined for empty strings array", () => {
      expect(findQueryComment([""])).toBeUndefined();
   });
});

describe("getCanonicalInsertKeys — uncovered paths", () => {
   test("throws on empty inserts", () => {
      expect(() => getCanonicalInsertKeys(Account.cols, [])).toThrow("No inserts provided");
   });

   test("throws on mismatched keys between rows", () => {
      expect(() =>
         getCanonicalInsertKeys(Account.cols, [{ accountId: "1" }, { email: "a@b.com" }]),
      ).toThrow("different columns");
   });

   test("throws on unknown column", () => {
      expect(() =>
         getCanonicalInsertKeys(Account.cols, [{ nonExistentCol: "value" }]),
      ).toThrow("does not exist");
   });

   test("returns keys in row-order filtered by insert keys", () => {
      const keys = getCanonicalInsertKeys(Account.cols, [{ accountId: "1", email: "a@b.com" }]);
      expect(keys).toContain("accountId");
      expect(keys).toContain("email");
   });
});

describe("deserialize — uncovered paths", () => {
   test("returns non-object data unchanged", () => {
      expect(deserialize(null, {})).toBeNull();
      expect(deserialize(42, {})).toBe(42);
      expect(deserialize("str", {})).toBe("str");
   });

   test("deserializes Date strings", () => {
      const result = deserialize({ createdAt: "2024-01-01T00:00:00Z" }, { createdAt: "Date" });
      expect(result.createdAt).toBeInstanceOf(Date);
   });

   test("leaves Date instances untouched", () => {
      const d = new Date("2024-01-01");
      const result = deserialize({ createdAt: d }, { createdAt: "Date" });
      expect(result.createdAt).toBeInstanceOf(Date);
   });

   test("leaves null Date values as null", () => {
      const result = deserialize({ createdAt: null }, { createdAt: "Date" });
      expect(result.createdAt).toBeNull();
   });

   test("deserializes nested JSON object from string", () => {
      const result = deserialize(
         { profile: JSON.stringify({ createdAt: "2024-01-01T00:00:00Z", age: 30 }) },
         { profile: { createdAt: "Date" } },
      );
      expect((result.profile as unknown as Record<string, unknown>).createdAt).toBeInstanceOf(Date);
      expect((result.profile as unknown as Record<string, unknown>).age).toBe(30);
   });

   test("deserializes nested object (already parsed)", () => {
      const result = deserialize(
         { profile: { createdAt: "2024-01-01T00:00:00Z" } },
         { profile: { createdAt: "Date" } },
      );
      expect((result.profile as Record<string, unknown>).createdAt).toBeInstanceOf(Date);
   });

   test("deserializes array from JSON string", () => {
      const result = deserialize(
         { items: JSON.stringify([{ createdAt: "2024-01-01T00:00:00Z" }, { createdAt: "2024-06-01T00:00:00Z" }]) },
         { items: [{ createdAt: "Date" }] },
      );
      expect((result.items as unknown as Record<string, unknown>[])[0]!.createdAt).toBeInstanceOf(Date);
      expect((result.items as unknown as Record<string, unknown>[])[1]!.createdAt).toBeInstanceOf(Date);
   });

   test("deserializes array already parsed", () => {
      const result = deserialize(
         { items: [{ createdAt: "2024-01-01T00:00:00Z" }] },
         { items: [{ createdAt: "Date" }] },
      );
      expect((result.items as Record<string, unknown>[])[0]!.createdAt).toBeInstanceOf(Date);
   });

   test("handles array of data (top-level array)", () => {
      const result = deserialize(
         [{ createdAt: "2024-01-01T00:00:00Z" }, { createdAt: "2024-06-01T00:00:00Z" }],
         { createdAt: "Date" },
      );
      expect(result[0]!.createdAt).toBeInstanceOf(Date);
      expect(result[1]!.createdAt).toBeInstanceOf(Date);
   });

   test("skips keys without matching schema rule", () => {
      const result = deserialize({ name: "test", age: 30 }, { age: "Date" });
      expect(result.name).toBe("test");
   });
});
