/**
 * MongoDB query definitions — demonstrates document-native patterns
 * that don't exist in SQL:
 *
 * - Embedded arrays with nested objects (orders.items[].metadata.dimensions)
 * - Aggregation pipelines ($unwind, $group, $lookup, $project)
 * - Dot-path queries on nested fields (metadata.brand, availability.isAvailable)
 * - Array operators ($elemMatch, $in on nested arrays)
 * - Denormalized data patterns (product info embedded in order items)
 */
import { param } from "@vexnor/core";
import { collection } from "@vexnor/mongodb";

// ─── Document types (MongoDB-native — nested, denormalized) ──────────────────

interface IAccount {
   _id: string;
   status: "created" | "confirmed" | "deleted";
   email: string;
   name: { first: string; last: string };
   notes: string | null;
   parent: { accountId: string; email: string } | null;
   createdAt: Date;
   modifiedAt: Date;
}

interface IProduct {
   _id: string;
   label: string;
   price: number;
   discount: number | null;
   availability: { isAvailable: boolean; isPublished: boolean };
   metadata: {
      brand: string;
      weight: number;
      dimensions: { width: number; height: number; depth: number };
      colors: string[];
      countryOfOrigin: string;
      releaseDate: string;
      isRecyclable: boolean;
   } | null;
   tags: string[];
   createdAt: Date;
   modifiedAt: Date;
}

interface IOrder {
   _id: string;
   status: "created" | "paid" | "delivered" | "received";
   accountId: string;
   items: {
      productId: string;
      label: string;
      productPrice: number;
      discountPrice: number | null;
      quantity: number;
      metadata: {
         brand: string;
         weight: number;
         dimensions: { width: number; height: number; depth: number };
         colors: string[];
         countryOfOrigin: string;
         releaseDate: string;
         isRecyclable: boolean;
      } | null;
   }[];
   createdAt: Date;
   modifiedAt: Date;
}

// ─── Collections with schema descriptors ─────────────────────────────────────

export const Accounts = collection<IAccount>("accounts", {
   source: "@vexnor/example-react-next-app:mongodb",
   schema: {
      _id: "string",
      status: "string",
      email: "string",
      name: { first: "string", last: "string" },
      notes: "string",
      parent: { accountId: "string", email: "string" },
      createdAt: "date",
      modifiedAt: "date",
   },
});

export const Products = collection<IProduct>("products", {
   source: "@vexnor/example-react-next-app:mongodb",
   schema: {
      _id: "string",
      label: "string",
      price: "number",
      discount: "number",
      availability: { isAvailable: "boolean", isPublished: "boolean" },
      metadata: {
         brand: "string",
         weight: "number",
         dimensions: { width: "number", height: "number", depth: "number" },
         colors: ["string"],
         countryOfOrigin: "string",
         releaseDate: "string",
         isRecyclable: "boolean",
      },
      tags: ["string"],
      createdAt: "date",
      modifiedAt: "date",
   },
});

export const Orders = collection<IOrder>("orders", {
   source: "@vexnor/example-react-next-app:mongodb",
   schema: {
      _id: "string",
      status: "string",
      accountId: "string",
      items: [{
         productId: "string",
         label: "string",
         productPrice: "number",
         discountPrice: "number",
         quantity: "integer",
         metadata: {
            brand: "string",
            weight: "number",
            dimensions: { width: "number", height: "number", depth: "number" },
            colors: ["string"],
            countryOfOrigin: "string",
            releaseDate: "string",
            isRecyclable: "boolean",
         },
      }],
      createdAt: "date",
      modifiedAt: "date",
   },
});

// ─── Queries: Accounts ───────────────────────────────────────────────────────

/** Find accounts by status with sort + limit */
export const findAccounts = Accounts.find(
   { status: param<{ status: string }>("status") },
   { sort: { createdAt: -1 }, limit: param<{ limit: number }>("limit") },
);

/** Delete an account */
export const deleteAccount = Accounts.deleteOne({ _id: param<{ id: string }>("id") });

/** Insert a new account */
export const insertAccount = Accounts.insertOne(param<{ doc: IAccount }>("doc"));

// ─── Queries: Products (nested metadata, dot-path, array queries) ────────────

/** Find products by tag — queries into a scalar array field */
export const findProductsByTag = Products.find(
   { tags: param<{ tag: string }>("tag"), "availability.isAvailable": true },
   { sort: { price: 1 }, limit: 20 },
);

/** Find products by brand — dot-path query into nested metadata */
export const findProductsByBrand = Products.find(
   { "metadata.brand": param<{ brand: string }>("brand") },
   { sort: { price: -1 } },
);

/** Find products by country — deep nested dot-path */
export const findProductsByCountry = Products.find(
   { "metadata.countryOfOrigin": param<{ country: string }>("country") },
);

/** Find products with specific color in metadata.colors array */
export const findProductsByColor = Products.find(
   { "metadata.colors": param<{ color: string }>("color") },
);

// ─── Queries: Orders (embedded arrays, denormalized items) ───────────────────

/** Find orders by status — shows embedded items array */
export const findOrdersByStatus = Orders.find(
   { status: param<{ status: string }>("status") },
   { sort: { createdAt: -1 }, limit: param<{ limit: number }>("limit") },
);

/** Find orders containing a specific product — queries into array of objects */
export const findOrdersByProduct = Orders.find(
   { "items.productId": param<{ productId: string }>("productId") },
   { sort: { createdAt: -1 } },
);

/** Find orders with high-value items — range query on nested array field */
export const findExpensiveOrders = Orders.find(
   { "items.productPrice": { $gte: param<{ minPrice: number }>("minPrice") } },
   { sort: { createdAt: -1 }, limit: 20 },
);

// ─── Aggregation Pipelines (the MongoDB power) ──────────────────────────────

/** Revenue by status — $group on order status */
export const revenueByStatus = Orders.aggregate<{
   _id: string;
   orderCount: number;
   totalItems: number;
}>([
   { $unwind: "$items" },
   { $group: {
      _id: "$status",
      orderCount: { $addToSet: "$_id" },
      totalItems: { $sum: "$items.quantity" },
   }},
   { $project: {
      _id: 1,
      orderCount: { $size: "$orderCount" },
      totalItems: 1,
   }},
   { $sort: { totalItems: -1 } },
]);

/** Top brands by order volume — $unwind items, group by embedded metadata.brand */
export const topBrandsByOrders = Orders.aggregate<{
   _id: string;
   orderCount: number;
   totalQuantity: number;
}>([
   { $unwind: "$items" },
   { $match: { "items.metadata": { $ne: null } } },
   { $group: {
      _id: "$items.metadata.brand",
      orderCount: { $sum: 1 },
      totalQuantity: { $sum: "$items.quantity" },
   }},
   { $sort: { totalQuantity: -1 } },
   { $limit: 10 },
]);

/** Orders with full account info — $lookup cross-collection join */
export const ordersWithAccount = Orders.aggregate<IOrder & { account: IAccount[] }>([
   { $match: { status: param<{ status: string }>("status") } },
   { $sort: { createdAt: -1 } },
   { $limit: 10 },
   { $lookup: { from: Accounts, localField: "accountId", foreignField: "_id", as: "account" } },
]);

/** Products by dimension range — queries nested metadata.dimensions */
export const productsBySize = Products.aggregate<{
   _id: string;
   label: string;
   volume: number;
   brand: string;
}>([
   { $match: { metadata: { $ne: null } } },
   { $project: {
      label: 1,
      brand: "$metadata.brand",
      volume: {
         $multiply: ["$metadata.dimensions.width", "$metadata.dimensions.height", "$metadata.dimensions.depth"],
      },
   }},
   { $sort: { volume: -1 } },
   { $limit: 10 },
]);

/** Country distribution — group by nested countryOfOrigin */
export const productsByCountry = Products.aggregate<{
   _id: string;
   count: number;
   avgPrice: number;
}>([
   { $match: { metadata: { $ne: null } } },
   { $group: {
      _id: "$metadata.countryOfOrigin",
      count: { $sum: 1 },
      avgPrice: { $avg: "$price" },
   }},
   { $sort: { count: -1 } },
]);
