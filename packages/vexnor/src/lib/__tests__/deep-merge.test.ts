import { describe, expect, test } from "vitest";
import { deepMerge } from "#/lib/deep-merge.js";

describe("deepMerge", () => {
   // ─── Object + Object ──────────────────────────────────────────────────────

   describe("object + object", () => {
      test("disjoint keys", () => {
         expect(deepMerge({ a: 1 }, { b: 2 })).toMatchInlineSnapshot(`
           {
             "a": 1,
             "b": 2,
           }
         `);
      });

      test("overlapping keys — later wins", () => {
         expect(deepMerge({ a: 1, b: 2 }, { a: 10, c: 3 })).toMatchInlineSnapshot(`
           {
             "a": 10,
             "b": 2,
             "c": 3,
           }
         `);
      });

      test("nested objects merge deeply", () => {
         expect(deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 3, z: 4 } })).toMatchInlineSnapshot(`
           {
             "a": {
               "x": 1,
               "y": 3,
               "z": 4,
             },
           }
         `);
      });

      test("3+ levels deep", () => {
         expect(deepMerge({ a: { b: { c: 1, d: 2 } } }, { a: { b: { d: 3, e: 4 } } })).toMatchInlineSnapshot(`
           {
             "a": {
               "b": {
                 "c": 1,
                 "d": 3,
                 "e": 4,
               },
             },
           }
         `);
      });

      test("empty objects", () => {
         expect(deepMerge({}, {})).toMatchInlineSnapshot(`{}`);
      });

      test("empty into populated", () => {
         expect(deepMerge({ a: 1 }, {})).toMatchInlineSnapshot(`
           {
             "a": 1,
           }
         `);
      });

      test("populated into empty", () => {
         expect(deepMerge({}, { a: 1 })).toMatchInlineSnapshot(`
           {
             "a": 1,
           }
         `);
      });
   });

   // ─── Value + Object ───────────────────────────────────────────────────────

   describe("value + object", () => {
      test("string replaced by object", () => {
         expect(deepMerge({ a: "hello" }, { a: { nested: true } })).toMatchInlineSnapshot(`
           {
             "a": {
               "nested": true,
             },
           }
         `);
      });

      test("number replaced by object", () => {
         expect(deepMerge({ a: 42 }, { a: { x: 1 } })).toMatchInlineSnapshot(`
           {
             "a": {
               "x": 1,
             },
           }
         `);
      });

      test("boolean replaced by object", () => {
         expect(deepMerge({ a: true }, { a: { flag: false } })).toMatchInlineSnapshot(`
           {
             "a": {
               "flag": false,
             },
           }
         `);
      });

      test("null replaced by object", () => {
         expect(deepMerge({ a: null }, { a: { x: 1 } })).toMatchInlineSnapshot(`
           {
             "a": {
               "x": 1,
             },
           }
         `);
      });
   });

   // ─── Object + Value ───────────────────────────────────────────────────────

   describe("object + value", () => {
      test("object replaced by string", () => {
         expect(deepMerge({ a: { x: 1 } }, { a: "overridden" })).toMatchInlineSnapshot(`
           {
             "a": "overridden",
           }
         `);
      });

      test("object replaced by number", () => {
         expect(deepMerge({ a: { x: 1 } }, { a: 99 })).toMatchInlineSnapshot(`
           {
             "a": 99,
           }
         `);
      });

      test("object replaced by null", () => {
         expect(deepMerge({ a: { x: 1 } }, { a: null })).toMatchInlineSnapshot(`
           {
             "a": null,
           }
         `);
      });

      test("object NOT replaced by undefined (skipped)", () => {
         expect(deepMerge({ a: { x: 1 } }, { a: undefined })).toMatchInlineSnapshot(`
           {
             "a": {
               "x": 1,
             },
           }
         `);
      });
   });

   // ─── Array + Array ────────────────────────────────────────────────────────

   describe("array + array", () => {
      test("later array replaces entirely", () => {
         expect(deepMerge({ a: [1, 2, 3] }, { a: [4, 5] })).toMatchInlineSnapshot(`
           {
             "a": [
               4,
               5,
             ],
           }
         `);
      });

      test("empty array replaces populated", () => {
         expect(deepMerge({ a: [1, 2] }, { a: [] })).toMatchInlineSnapshot(`
           {
             "a": [],
           }
         `);
      });

      test("array of objects replaces (no deep merge into array elements)", () => {
         expect(deepMerge({ a: [{ x: 1 }] }, { a: [{ y: 2 }] })).toMatchInlineSnapshot(`
           {
             "a": [
               {
                 "y": 2,
               },
             ],
           }
         `);
      });
   });

   // ─── Value + Array ────────────────────────────────────────────────────────

   describe("value + array", () => {
      test("string replaced by array", () => {
         expect(deepMerge({ a: "hello" }, { a: [1, 2] })).toMatchInlineSnapshot(`
           {
             "a": [
               1,
               2,
             ],
           }
         `);
      });

      test("number replaced by array", () => {
         expect(deepMerge({ a: 42 }, { a: [true, false] })).toMatchInlineSnapshot(`
           {
             "a": [
               true,
               false,
             ],
           }
         `);
      });
   });

   // ─── Array + Value ────────────────────────────────────────────────────────

   describe("array + value", () => {
      test("array replaced by string", () => {
         expect(deepMerge({ a: [1, 2] }, { a: "replaced" })).toMatchInlineSnapshot(`
           {
             "a": "replaced",
           }
         `);
      });

      test("array replaced by number", () => {
         expect(deepMerge({ a: [1, 2] }, { a: 0 })).toMatchInlineSnapshot(`
           {
             "a": 0,
           }
         `);
      });

      test("array replaced by null", () => {
         expect(deepMerge({ a: [1, 2] }, { a: null })).toMatchInlineSnapshot(`
           {
             "a": null,
           }
         `);
      });
   });

   // ─── Array + Object ───────────────────────────────────────────────────────

   describe("array + object", () => {
      test("array replaced by object", () => {
         expect(deepMerge({ a: [1, 2] }, { a: { x: 1 } })).toMatchInlineSnapshot(`
           {
             "a": {
               "x": 1,
             },
           }
         `);
      });
   });

   // ─── Object + Array ───────────────────────────────────────────────────────

   describe("object + array", () => {
      test("object replaced by array", () => {
         expect(deepMerge({ a: { x: 1 } }, { a: [1, 2, 3] })).toMatchInlineSnapshot(`
           {
             "a": [
               1,
               2,
               3,
             ],
           }
         `);
      });
   });

   // ─── Special values ───────────────────────────────────────────────────────

   describe("special values", () => {
      test("Date replaces Date", () => {
         const d2 = new Date("2024-01-01");
         expect(deepMerge({ d: new Date("2020-01-01") }, { d: d2 })).toMatchInlineSnapshot(`
           {
             "d": 2024-01-01T00:00:00.000Z,
           }
         `);
      });

      test("Date replaces object (not merged into)", () => {
         const d = new Date("2024-01-01");
         expect(deepMerge({ d: { x: 1 } }, { d: d })).toMatchInlineSnapshot(`
           {
             "d": 2024-01-01T00:00:00.000Z,
           }
         `);
      });

      test("RegExp replaces RegExp", () => {
         expect(deepMerge({ r: /old/ }, { r: /new/gi })).toMatchInlineSnapshot(`
           {
             "r": /new/gi,
           }
         `);
      });

      test("class instance replaces object (not merged)", () => {
         class Foo { x = 1; }
         const foo = new Foo();
         expect(deepMerge({ a: { y: 2 } }, { a: foo })).toMatchInlineSnapshot(`
           {
             "a": Foo {
               "x": 1,
             },
           }
         `);
      });

      test("object replaces class instance (not merged into)", () => {
         class Foo { x = 1; }
         expect(deepMerge({ a: new Foo() }, { a: { y: 2 } })).toMatchInlineSnapshot(`
           {
             "a": {
               "y": 2,
             },
           }
         `);
      });
   });

   // ─── Multiple sources ─────────────────────────────────────────────────────

   describe("multiple sources", () => {
      test("three sources — last wins", () => {
         expect(deepMerge({ a: 1 }, { a: 2 }, { a: 3 })).toMatchInlineSnapshot(`
           {
             "a": 3,
           }
         `);
      });

      test("progressive deep merge across 3 sources", () => {
         expect(deepMerge(
            { a: { x: 1, y: 1 } },
            { a: { y: 2, z: 2 } },
            { a: { z: 3, w: 3 } },
         )).toMatchInlineSnapshot(`
           {
             "a": {
               "w": 3,
               "x": 1,
               "y": 2,
               "z": 3,
             },
           }
         `);
      });

      test("skips null and undefined sources", () => {
         expect(deepMerge({ a: 1 }, null as never, undefined as never, { b: 2 })).toMatchInlineSnapshot(`
           {
             "a": 1,
             "b": 2,
           }
         `);
      });
   });

   // ─── Edge cases ───────────────────────────────────────────────────────────

   describe("edge cases", () => {
      test("undefined does not delete existing key", () => {
         expect(deepMerge({ a: 1, b: 2 }, { a: undefined, b: 3 })).toMatchInlineSnapshot(`
           {
             "a": 1,
             "b": 3,
           }
         `);
      });

      test("deeply nested undefined preserves", () => {
         expect(deepMerge({ a: { b: { c: 1 } } }, { a: { b: { c: undefined } } })).toMatchInlineSnapshot(`
           {
             "a": {
               "b": {
                 "c": 1,
               },
             },
           }
         `);
      });

      test("prototype pollution blocked", () => {
         const malicious = JSON.parse('{"__proto__": {"polluted": true}}');
         const result = deepMerge({}, malicious);
         expect(result).toMatchInlineSnapshot(`{}`);
         expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
      });

      test("constructor key blocked", () => {
         const result = deepMerge({}, { constructor: { polluted: true } } as never);
         expect(result).toMatchInlineSnapshot(`{}`);
      });

      test("wide object (100 keys)", () => {
         const wide: Record<string, number> = {};
         for (let i = 0; i < 100; i++) wide[`k${i}`] = i;
         const result = deepMerge(wide, { k50: 999 });
         expect(result.k0).toBe(0);
         expect(result.k50).toBe(999);
         expect(result.k99).toBe(99);
         expect(Object.keys(result)).toHaveLength(100);
      });
   });
});
