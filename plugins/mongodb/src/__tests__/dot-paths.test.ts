import { describe, it, expect, vi } from "vitest";
import { param, ctx } from "@vexnor/core";
import { collection } from "#src/collection.js";
import type { DotPaths, DotPathType } from "#src/mongo-types.js";

// ─── Test document with deep nesting ─────────────────────────────────────────

interface Product {
   _id: string;
   label: string;
   price: number;
   availability: { isAvailable: boolean; isPublished: boolean };
   metadata: {
      brand: string;
      weight: number;
      dimensions: { width: number; height: number; depth: number };
      colors: string[];
      countryOfOrigin: string;
   } | null;
   tags: string[];
   items: { productId: string; qty: number }[];
   createdAt: Date;
}

const products = collection<Product>("products", {
   source: "test",
   schema: {
      _id: "string",
      label: "string",
      price: "number",
      availability: { isAvailable: "boolean", isPublished: "boolean" },
      metadata: {
         brand: "string",
         weight: "number",
         dimensions: { width: "number", height: "number", depth: "number" },
         colors: ["string"],
         countryOfOrigin: "string",
      },
      tags: ["string"],
      items: [{ productId: "string", qty: "integer" }],
      createdAt: "date",
   },
});

// ─── Type-level assertions (compile-time only) ───────────────────────────────

// These verify that DotPaths produces the correct union at the type level.
// If any of these fail, tsc will error on this file.
type Paths = DotPaths<Product>;

// Valid paths — these must compile:
const _validPaths: Paths[] = [
   "_id",
   "label",
   "price",
   "availability",
   "availability.isAvailable",
   "availability.isPublished",
   "metadata",
   "metadata.brand",
   "metadata.weight",
   "metadata.dimensions",
   "metadata.dimensions.width",
   "metadata.dimensions.height",
   "metadata.dimensions.depth",
   "metadata.colors",
   "metadata.countryOfOrigin",
   "tags",
   "items",
   "items.productId",
   "items.qty",
   "createdAt",
];
void _validPaths;

// DotPathType resolves correctly:
type _AssertBrand = DotPathType<Product, "metadata.brand"> extends string ? true : never;
type _AssertWidth = DotPathType<Product, "metadata.dimensions.width"> extends number ? true : never;
type _AssertQty = DotPathType<Product, "items.qty"> extends number ? true : never;
type _AssertAvail = DotPathType<Product, "availability.isAvailable"> extends boolean ? true : never;
const _typeChecks: [_AssertBrand, _AssertWidth, _AssertQty, _AssertAvail] = [true, true, true, true];
void _typeChecks;

// ─── Runtime tests — dot-path queries produce correct descriptors ────────────

describe("DotPaths integration", () => {
   describe("dot-path filter in find()", () => {
      it("produces correct descriptor for top-level dot-path", () => {
         const query = products.find({ "availability.isAvailable": true });

         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "availability.isAvailable": {
                 "$literal": true,
               },
             },
             "operation": "find",
           }
         `);
      });

      it("produces correct descriptor for deep dot-path", () => {
         const query = products.find({ "metadata.dimensions.width": { $gt: 10 } });

         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "metadata.dimensions.width": {
                 "$gt": {
                   "$literal": 10,
                 },
               },
             },
             "operation": "find",
           }
         `);
      });

      it("produces correct descriptor for array item dot-path", () => {
         const query = products.find({ "items.productId": "prod-1" });

         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "items.productId": {
                 "$literal": "prod-1",
               },
             },
             "operation": "find",
           }
         `);
      });

      it("produces correct descriptor for dot-path with param", () => {
         const brandParam = param<{ brand: string }>("brand");
         const query = products.find({ "metadata.brand": brandParam });

         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "metadata.brand": {
                 "$param": "brand",
               },
             },
             "operation": "find",
           }
         `);
         expect(query.params.brand).toMatchInlineSnapshot(`
           {
             "isContext": false,
             "name": "brand",
           }
         `);
      });

      it("produces correct descriptor for nested array field query", () => {
         const query = products.find({ "metadata.colors": "red" });

         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "metadata.colors": {
                 "$literal": "red",
               },
             },
             "operation": "find",
           }
         `);
      });

      it("combines dot-path with top-level keys", () => {
         const tagParam = param<{ tag: string }>("tag");
         const query = products.find({
            tags: tagParam,
            "availability.isAvailable": true,
            "metadata.countryOfOrigin": "US",
         });

         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "availability.isAvailable": {
                 "$literal": true,
               },
               "metadata.countryOfOrigin": {
                 "$literal": "US",
               },
               "tags": {
                 "$param": "tag",
               },
             },
             "operation": "find",
           }
         `);
      });

      it("dot-path queries produce deterministic hashes", async () => {
         const q1 = products.find({ "metadata.brand": "WidgetCo", "availability.isAvailable": true });
         const q2 = products.find({ "availability.isAvailable": true, "metadata.brand": "WidgetCo" });

         // Same logical filter, different key order → same hash (canonical JSON)
         expect(await q1.hash).toBe(await q2.hash);
      });

      it("different dot-paths produce different hashes", async () => {
         const q1 = products.find({ "metadata.brand": "WidgetCo" });
         const q2 = products.find({ "metadata.countryOfOrigin": "WidgetCo" });

         expect(await q1.hash).not.toBe(await q2.hash);
      });
   });

   describe("dot-path in deleteOne/updateOne", () => {
      it("deleteOne with dot-path filter", () => {
         const query = products.deleteOne({ "availability.isPublished": false });

         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "availability.isPublished": {
                 "$literal": false,
               },
             },
             "operation": "deleteOne",
           }
         `);
      });

      it("updateOne with dot-path filter", () => {
         const query = products.updateOne(
            { "metadata.brand": "OldBrand" },
            { $set: { "metadata.brand": "NewBrand" } },
         );

         expect(query.descriptor.filter).toMatchInlineSnapshot(`
           {
             "metadata.brand": {
               "$literal": "OldBrand",
             },
           }
         `);
      });
   });

   describe("dot-path with ctx()", () => {
      it("ctx at dot-path position is extracted as context param", () => {
         const userCountry = ctx<{ userCountry: string }>("userCountry");
         const query = products.find({ "metadata.countryOfOrigin": userCountry });

         expect(query.params.userCountry).toMatchInlineSnapshot(`
           {
             "isContext": true,
             "name": "userCountry",
           }
         `);
         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "metadata.countryOfOrigin": {
                 "$ctx": "userCountry",
               },
             },
             "operation": "find",
           }
         `);
      });
   });

   describe("dot-path with MongoDB operators", () => {
      it("$in on a dot-path field", () => {
         const query = products.find({ "metadata.countryOfOrigin": { $in: ["US", "DE", "JP"] } });

         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "metadata.countryOfOrigin": {
                 "$in": [
                   {
                     "$literal": "US",
                   },
                   {
                     "$literal": "DE",
                   },
                   {
                     "$literal": "JP",
                   },
                 ],
               },
             },
             "operation": "find",
           }
         `);
      });

      it("$gte/$lte range on a deep dot-path", () => {
         const query = products.find({
            "metadata.dimensions.width": { $gte: 5, $lte: 20 },
         });

         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "metadata.dimensions.width": {
                 "$gte": {
                   "$literal": 5,
                 },
                 "$lte": {
                   "$literal": 20,
                 },
               },
             },
             "operation": "find",
           }
         `);
      });

      it("$elemMatch on array-of-objects field", () => {
         const query = products.find({
            items: { $elemMatch: { qty: { $gt: 5 }, productId: "prod-1" } },
         });

         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "items": {
                 "$elemMatch": {
                   "productId": {
                     "$literal": "prod-1",
                   },
                   "qty": {
                     "$gt": {
                       "$literal": 5,
                     },
                   },
                 },
               },
             },
             "operation": "find",
           }
         `);
      });

      it("$exists on a nullable dot-path", () => {
         const query = products.find({ "metadata.brand": { $exists: true } });

         expect(query.descriptor).toMatchInlineSnapshot(`
           {
             "collection": "products",
             "filter": {
               "metadata.brand": {
                 "$exists": {
                   "$literal": true,
                 },
               },
             },
             "operation": "find",
           }
         `);
      });
   });

   describe("dot-path execution with mock DB", () => {
      it("substitutes dot-path filter and passes to driver", async () => {
         const brandParam = param<{ brand: string }>("brand");
         const query = products.find({ "metadata.brand": brandParam, "availability.isAvailable": true });

         const mockCursor = {
            project: vi.fn().mockReturnThis(),
            sort: vi.fn().mockReturnThis(),
            skip: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            toArray: vi.fn().mockResolvedValue([{ _id: "prod-1", label: "Widget" }]),
         };
         const mockCollection = { find: vi.fn().mockReturnValue(mockCursor) };
         const mockDb = { collection: vi.fn().mockReturnValue(mockCollection) };

         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const results = await query.all({ db: mockDb as any, params: { brand: "WidgetCo" } });

         // Verify the substituted filter passed to the driver has dot-path keys preserved
         expect(mockCollection.find).toHaveBeenCalledWith({
            "metadata.brand": "WidgetCo",
            "availability.isAvailable": true,
         });
         expect(results).toHaveLength(1);
      });
   });
});
