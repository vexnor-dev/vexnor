/**
 * Type-level test — verifies DotPaths type safety for both success AND failure.
 * This file is checked by tsc (with typecheck enabled in vitest).
 *
 * - Valid usages compile without error
 * - Invalid usages are annotated with @ts-expect-error — if the type system
 *   ever stops rejecting them, tsc will error on the unused @ts-expect-error
 */
import { collection } from "#src/collection.js";
import { param } from "@vexnor/core";
import type { DotPaths, DotPathType } from "#src/mongo-types.js";

interface TestDoc {
   _id: string;
   status: "active" | "inactive";
   metadata: {
      brand: string;
      dimensions: { width: number; height: number; depth: number };
      colors: string[];
   };
   tags: string[];
   items: { productId: string; qty: number }[];
   createdAt: Date;
}

// ─── DotPaths: valid paths compile ───────────────────────────────────────────

type Paths = DotPaths<TestDoc>;

const _p1: Paths = "_id";
const _p2: Paths = "status";
const _p3: Paths = "metadata";
const _p4: Paths = "metadata.brand";
const _p5: Paths = "metadata.dimensions";
const _p6: Paths = "metadata.dimensions.width";
const _p7: Paths = "metadata.dimensions.height";
const _p8: Paths = "metadata.dimensions.depth";
const _p9: Paths = "metadata.colors";
const _p10: Paths = "tags";
const _p11: Paths = "items";
const _p12: Paths = "items.productId";
const _p13: Paths = "items.qty";
const _p14: Paths = "createdAt";

// ─── DotPaths: INVALID paths rejected ────────────────────────────────────────

// @ts-expect-error — "nonExistent" is not a key on TestDoc
const _bad1: Paths = "nonExistent";

// @ts-expect-error — "metadata.nonExistent" is not a valid dot-path
const _bad2: Paths = "metadata.nonExistent";

// @ts-expect-error — "metadata.dimensions.nonExistent" doesn't exist
const _bad3: Paths = "metadata.dimensions.nonExistent";

// @ts-expect-error — "items.nonExistent" doesn't exist on array element
const _bad4: Paths = "items.nonExistent";

// @ts-expect-error — "status.something" — status is a string, not an object
const _bad5: Paths = "status.something";

// ─── DotPathType: correct type resolution ────────────────────────────────────

type _T1 = DotPathType<TestDoc, "_id">; // string
type _T2 = DotPathType<TestDoc, "metadata.brand">; // string
type _T3 = DotPathType<TestDoc, "metadata.dimensions.width">; // number
type _T4 = DotPathType<TestDoc, "items.qty">; // number
type _T5 = DotPathType<TestDoc, "metadata.colors">; // string[]

const _v1: _T1 = "hello";
const _v2: _T2 = "WidgetCo";
const _v3: _T3 = 42;
const _v4: _T4 = 5;
const _v5: _T5 = ["red", "blue"];

// ─── DotPathType: WRONG type assignments rejected ────────────────────────────

// @ts-expect-error — _id is string, not number
const _badV1: _T1 = 123;

// @ts-expect-error — metadata.dimensions.width is number, not string
const _badV2: _T3 = "ten";

// @ts-expect-error — metadata.colors is string[], not string
const _badV3: _T5 = "red";

// ─── MongoFilter: valid filter usage ─────────────────────────────────────────

const col = collection<TestDoc>("test", {
   source: "test",
   schema: { _id: "string", status: "string", metadata: { brand: "string", dimensions: { width: "number", height: "number", depth: "number" }, colors: ["string"] }, tags: ["string"], items: [{ productId: "string", qty: "integer" }], createdAt: "date" },
});

// Top-level keys
col.find({ status: "active" });
col.find({ _id: "123" });

// Dot-path keys with correct types
col.find({ "metadata.brand": "WidgetCo" });
col.find({ "metadata.dimensions.width": { $gt: 10 } });
col.find({ "items.productId": "prod-1" });
col.find({ "metadata.colors": "red" }); // array containment

// Param at any position
col.find({ status: param<{ status: string }>("status") });
col.find({ "metadata.brand": param<{ brand: string }>("brand") });
col.find({ "metadata.dimensions.width": param<{ width: number }>("width") });

// Operators
col.find({ status: { $in: ["active", "inactive"] } });
col.find({ "metadata.dimensions.width": { $gte: 5, $lte: 20 } });
col.find({ "metadata.brand": { $regex: /^Widget/ } });
col.find({ items: { $elemMatch: { qty: { $gt: 5 } } } });
col.find({ tags: { $all: ["electronics", "gadgets"] } });

// Logical operators
col.find({ $or: [{ status: "active" }, { "metadata.brand": "WidgetCo" }] });
col.find({ $and: [{ "metadata.dimensions.width": { $gt: 5 } }, { "items.qty": { $lt: 100 } }] });

// ─── MongoFilter: INVALID filter usage rejected ──────────────────────────────

// @ts-expect-error — "metadata.nonExistent" is not a valid dot-path
col.find({ "metadata.nonExistent": "oops" });

// @ts-expect-error — $gt expects number for a number field, not string
col.find({ "metadata.dimensions.width": { $gt: "ten" } });

// @ts-expect-error — $regex not valid on number fields
col.find({ "metadata.dimensions.width": { $regex: /abc/ } });

// @ts-expect-error — "nonExistentField" is not a key on TestDoc
col.find({ nonExistentField: "value" });

// ─── Suppress unused warnings ────────────────────────────────────────────────
void [_p1, _p2, _p3, _p4, _p5, _p6, _p7, _p8, _p9, _p10, _p11, _p12, _p13, _p14];
void [_bad1, _bad2, _bad3, _bad4, _bad5];
void [_v1, _v2, _v3, _v4, _v5, _badV1, _badV2, _badV3];
