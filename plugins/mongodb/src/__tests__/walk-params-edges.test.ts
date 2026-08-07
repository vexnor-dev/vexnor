import { describe, it, expect } from "vitest";
import { param } from "@vexnor/core";
import { walkFilter, walkValue, walkFindOptions } from "#src/walk-params.js";
import type { MongoParamInfo } from "#src/mongo-types.js";

describe("walkFilter edge cases", () => {
   it("handles Date values in filter", () => {
      const params: Record<string, MongoParamInfo> = {};
      const date = new Date("2024-06-15T00:00:00.000Z");
      const result = walkFilter({ createdAt: date }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "createdAt": {
            "$literal": "2024-06-15T00:00:00.000Z",
          },
        }
      `);
   });

   it("handles null value in filter field", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter({ deletedAt: null }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "deletedAt": {
            "$literal": null,
          },
        }
      `);
   });

   it("handles undefined value in filter field", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter({ optional: undefined }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "optional": {
            "$literal": undefined,
          },
        }
      `);
   });

   it("handles $in operator with array", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter({ status: { $in: ["active", "pending"] } }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "status": {
            "$in": [
              {
                "$literal": "active",
              },
              {
                "$literal": "pending",
              },
            ],
          },
        }
      `);
   });

   it("handles nested document in filter", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter({ "address.city": "NYC" }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "address.city": {
            "$literal": "NYC",
          },
        }
      `);
   });

   it("handles param at top level", () => {
      const params: Record<string, MongoParamInfo> = {};
      const filterParam = param<{ filter: object }>("filter");
      const result = walkFilter(filterParam, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "$param": "filter",
        }
      `);
      expect(params.filter).toBeDefined();
   });

   it("handles boolean values", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter({ active: true }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "active": {
            "$literal": true,
          },
        }
      `);
   });

   it("handles numeric values", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter({ score: { $gte: 90 } }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "score": {
            "$gte": {
              "$literal": 90,
            },
          },
        }
      `);
   });
});

describe("walkValue edge cases", () => {
   it("handles Date with literalWrap=true", () => {
      const params: Record<string, MongoParamInfo> = {};
      const date = new Date("2024-01-01T00:00:00.000Z");
      const result = walkValue(date, params, true);

      expect(result).toMatchInlineSnapshot(`
        {
          "$literal": "2024-01-01T00:00:00.000Z",
        }
      `);
   });

   it("handles Date with literalWrap=false", () => {
      const params: Record<string, MongoParamInfo> = {};
      const date = new Date("2024-01-01T00:00:00.000Z");
      const result = walkValue(date, params, false);

      expect(result).toBe("2024-01-01T00:00:00.000Z");
   });

   it("handles scalar with literalWrap=true", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkValue("hello", params, true);

      expect(result).toMatchInlineSnapshot(`
        {
          "$literal": "hello",
        }
      `);
   });

   it("handles scalar with literalWrap=false", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkValue("hello", params, false);
      expect(result).toBe("hello");
   });

   it("handles nested objects", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkValue({ a: { b: 1 } }, params, false);

      expect(result).toMatchInlineSnapshot(`
        {
          "a": {
            "b": 1,
          },
        }
      `);
   });

   it("handles arrays", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkValue([1, 2, 3], params, true);

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "$literal": 1,
          },
          {
            "$literal": 2,
          },
          {
            "$literal": 3,
          },
        ]
      `);
   });

   it("handles null", () => {
      const params: Record<string, MongoParamInfo> = {};
      expect(walkValue(null, params, true)).toBeNull();
   });

   it("handles undefined", () => {
      const params: Record<string, MongoParamInfo> = {};
      expect(walkValue(undefined, params, true)).toBeUndefined();
   });
});

describe("walkFindOptions edge cases", () => {
   it("handles undefined options", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFindOptions(undefined, params);
      expect(result).toBeNull();
   });

   it("handles empty options", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFindOptions({}, params);
      expect(result).toMatchInlineSnapshot(`{}`);
   });

   it("handles skip as literal", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFindOptions({ skip: 50 }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "skip": {
            "$literal": 50,
          },
        }
      `);
   });

   it("skips null/undefined limit", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFindOptions({ limit: null }, params);
      expect(result).toMatchInlineSnapshot(`{}`);
   });

   it("handles projection", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFindOptions({ projection: { name: 1, _id: 0 } }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "projection": {
            "_id": 0,
            "name": 1,
          },
        }
      `);
   });
});
