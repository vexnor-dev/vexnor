import { describe, it, expect } from "vitest";
import { param, ctx } from "@vexnor/core";
import { walkFilter, walkFindOptions, walkPipeline, substituteParams } from "#src/walk-params.js";
import { collection } from "#src/collection.js";
import type { MongoParamInfo } from "#src/mongo-types.js";

describe("walkFilter", () => {
   it("wraps literal values in $literal", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter({ status: "shipped" }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "status": {
            "$literal": "shipped",
          },
        }
      `);
      expect(Object.keys(params)).toHaveLength(0);
   });

   it("replaces param() with $param marker", () => {
      const params: Record<string, MongoParamInfo> = {};
      const statusParam = param<{ status: string }>("status");
      const result = walkFilter({ status: statusParam }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "status": {
            "$param": "status",
          },
        }
      `);
      expect(params).toMatchInlineSnapshot(`
        {
          "status": {
            "isContext": false,
            "name": "status",
          },
        }
      `);
   });

   it("replaces ctx() with $ctx marker", () => {
      const params: Record<string, MongoParamInfo> = {};
      const userIdCtx = ctx<{ userId: string }>("userId");
      const result = walkFilter({ accountId: userIdCtx }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "accountId": {
            "$ctx": "userId",
          },
        }
      `);
      expect(params.userId!.isContext).toBe(true);
   });

   it("handles null filter", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter(null, params);
      expect(result).toBeNull();
   });

   it("handles empty filter", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter({}, params);
      expect(result).toMatchInlineSnapshot(`{}`);
   });

   it("handles MongoDB operators in filter", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter({ age: { $gt: 18, $lt: 65 } }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "age": {
            "$gt": {
              "$literal": 18,
            },
            "$lt": {
              "$literal": 65,
            },
          },
        }
      `);
   });

   it("handles $match in pipeline stages", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter({ $match: { status: "active" } }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "$match": {
            "status": {
              "$literal": "active",
            },
          },
        }
      `);
   });

   it("handles collection refs in $lookup", () => {
      const orders = collection("orders", { source: "test", schema: { _id: "string" } });
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFilter(
         { $lookup: { from: orders, localField: "_id", foreignField: "accountId", as: "orders" } },
         params,
      );

      expect(result).toMatchInlineSnapshot(`
        {
          "$lookup": {
            "as": {
              "$literal": "orders",
            },
            "foreignField": {
              "$literal": "accountId",
            },
            "from": "orders",
            "localField": {
              "$literal": "_id",
            },
          },
        }
      `);
   });

   it("handles mixed params and literals", () => {
      const params: Record<string, MongoParamInfo> = {};
      const statusParam = param<{ status: string }>("status");
      const result = walkFilter({ status: statusParam, active: true }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "active": {
            "$literal": true,
          },
          "status": {
            "$param": "status",
          },
        }
      `);
   });
});

describe("walkFindOptions", () => {
   it("handles limit as literal", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFindOptions({ limit: 20 }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "limit": {
            "$literal": 20,
          },
        }
      `);
   });

   it("handles limit as param", () => {
      const params: Record<string, MongoParamInfo> = {};
      const limitParam = param<{ limit: number }>("limit");
      const result = walkFindOptions({ limit: limitParam }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "limit": {
            "$param": "limit",
          },
        }
      `);
      expect(params.limit).toBeDefined();
   });

   it("handles sort option", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFindOptions({ sort: { createdAt: -1 } }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "sort": {
            "createdAt": -1,
          },
        }
      `);
   });

   it("handles null options", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkFindOptions(null, params);
      expect(result).toBeNull();
   });

   it("handles skip as param", () => {
      const params: Record<string, MongoParamInfo> = {};
      const skipParam = param<{ skip: number }>("skip");
      const result = walkFindOptions({ skip: skipParam }, params);

      expect(result).toMatchInlineSnapshot(`
        {
          "skip": {
            "$param": "skip",
          },
        }
      `);
   });
});

describe("walkPipeline", () => {
   it("walks a simple aggregation pipeline", () => {
      const params: Record<string, MongoParamInfo> = {};
      const result = walkPipeline(
         [{ $match: { status: "delivered" } }, { $group: { _id: "$country", count: { $sum: 1 } } }],
         params,
      );

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "$match": {
              "status": {
                "$literal": "delivered",
              },
            },
          },
          {
            "$group": {
              "_id": {
                "$literal": "$country",
              },
              "count": {
                "$sum": {
                  "$literal": 1,
                },
              },
            },
          },
        ]
      `);
   });

   it("extracts params from pipeline stages", () => {
      const params: Record<string, MongoParamInfo> = {};
      const statusParam = param<{ status: string }>("status");
      walkPipeline([{ $match: { status: statusParam } }], params);

      expect(params.status).toMatchInlineSnapshot(`
        {
          "isContext": false,
          "name": "status",
        }
      `);
   });
});

describe("substituteParams", () => {
   it("substitutes $param markers with runtime values", () => {
      const descriptor = {
         filter: { status: { $param: "status" } },
         limit: { $param: "limit" },
      };
      const result = substituteParams(descriptor, { status: "shipped", limit: 20 });

      expect(result).toMatchInlineSnapshot(`
        {
          "filter": {
            "status": "shipped",
          },
          "limit": 20,
        }
      `);
   });

   it("substitutes $ctx markers with context values", () => {
      const descriptor = { filter: { accountId: { $ctx: "userId" } } };
      const result = substituteParams(descriptor, { userId: "user-123" });

      expect(result).toMatchInlineSnapshot(`
        {
          "filter": {
            "accountId": "user-123",
          },
        }
      `);
   });

   it("unwraps $literal markers", () => {
      const descriptor = {
         filter: { status: { $literal: "shipped" } },
         limit: { $literal: 10 },
      };
      const result = substituteParams(descriptor, {});

      expect(result).toMatchInlineSnapshot(`
        {
          "filter": {
            "status": "shipped",
          },
          "limit": 10,
        }
      `);
   });

   it("handles arrays", () => {
      const descriptor = {
         pipeline: [
            { $match: { status: { $param: "status" } } },
            { $limit: { $literal: 10 } },
         ],
      };
      const result = substituteParams(descriptor, { status: "active" });

      expect(result).toMatchInlineSnapshot(`
        {
          "pipeline": [
            {
              "$match": {
                "status": "active",
              },
            },
            {
              "$limit": 10,
            },
          ],
        }
      `);
   });

   it("handles null and undefined", () => {
      expect(substituteParams(null, {})).toBeNull();
      expect(substituteParams(undefined, {})).toBeUndefined();
   });

   it("passes through plain values", () => {
      expect(substituteParams("hello", {})).toBe("hello");
      expect(substituteParams(42, {})).toBe(42);
      expect(substituteParams(true, {})).toBe(true);
   });
});
