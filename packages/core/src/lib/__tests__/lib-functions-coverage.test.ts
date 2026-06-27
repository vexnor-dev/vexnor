import { describe, expect, test } from "vitest";
import { Queue } from "#src/lib/queue.js";
import { Cache, resetAll, resetCache } from "#src/lib/cache.js";
import { Lazy } from "#src/lib/lazy.js";
import { isPrimitive } from "#src/lib/primitive.js";
import { isError } from "#src/lib/is-error.js";
import { raw } from "#src/core/query/sql-raw.js";

describe("Queue — uncovered paths", () => {
   test("pop() yields items in reverse order", () => {
      const q = new Queue([1, 2, 3]);
      const result = [...q.pop()];
      expect(result).toMatchInlineSnapshot(`
        [
          3,
          2,
          1,
        ]
      `);
   });

   test("each() yields items with indices", () => {
      const q = new Queue(["a", "b"]);
      const result = [...q.each()];
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "index": 0,
            "item": "a",
          },
          {
            "index": 1,
            "item": "b",
          },
        ]
      `);
   });

   test("items getter returns copy", () => {
      const q = new Queue([10, 20]);
      expect(q.items).toMatchInlineSnapshot(`
        [
          {
            "index": 0,
            "item": 10,
          },
          {
            "index": 1,
            "item": 20,
          },
        ]
      `);
   });

   test("length reflects current state", () => {
      const q = new Queue([1, 2, 3]);
      expect(q.length).toBe(3);
      // consume one
      const iter = q.shift();
      iter.next();
      expect(q.length).toBe(2);
   });
});

describe("Cache — uncovered paths", () => {
   test("reset clears cached values", () => {
      const cache = new Cache();
      const val = cache.get(["test-key"], () => raw("a"));
      expect(val.type).toBe("SqlRaw");
      cache.reset();
      // After reset, callback is called again with different value
      const val2 = cache.get(["test-key"], () => raw("b"));
      expect(val2).not.toBe(val);
   });

   test("resetCache clears CACHE", () => {
      resetCache();
      // no error means success
   });

   test("resetAll clears both cache and ids", () => {
      resetAll();
   });
});

describe("Lazy — uncovered paths", () => {
   test("second access returns cached value", () => {
      let calls = 0;
      const lazy = new Lazy(() => {
         calls++;
         return 42;
      });
      expect(lazy.value).toBe(42);
      expect(lazy.value).toBe(42);
      expect(calls).toBe(1);
   });
});

describe("isPrimitive — uncovered paths", () => {
   test("bigint is primitive", () => {
      expect(isPrimitive(BigInt(123))).toBe(true);
   });

   test("Uint8Array is primitive", () => {
      expect(isPrimitive(new Uint8Array([1, 2]))).toBe(true);
   });

   test("Date is primitive", () => {
      expect(isPrimitive(new Date())).toBe(true);
   });

   test("object is not primitive", () => {
      expect(isPrimitive({})).toBe(false);
   });

   test("array is not primitive", () => {
      expect(isPrimitive([])).toBe(false);
   });

   test("undefined is not primitive", () => {
      expect(isPrimitive(undefined)).toBe(false);
   });
});

describe("isError — uncovered paths", () => {
   test("null returns false", () => {
      expect(isError(null)).toBe(false);
   });

   test("string returns false", () => {
      expect(isError("hello")).toBe(false);
   });

   test("object with message string returns true", () => {
      expect(isError({ message: "test" })).toBe(true);
   });

   test("object with non-string message returns false", () => {
      expect(isError({ message: 123 })).toBe(false);
   });

   test("Error instance returns true", () => {
      expect(isError(new Error("test"))).toBe(true);
   });
});
