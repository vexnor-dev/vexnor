/**
 * MongoDB query definitions for the React Vite UI (SPA) example.
 *
 * These queries are defined once and used isomorphically:
 * - Client-side: executed via HttpRemoteClient (sends hash + params to server)
 * - Server-side: resolved by MongoQueryRegistry, executed against Db
 *
 * Demonstrates:
 * - collection<T>() with schema descriptor
 * - find with param() (user-supplied) and ctx() (server-injected)
 * - aggregate pipelines ($group, $sort, $lookup with typed collection ref)
 * - mutations (insertOne, updateOne, deleteOne)
 * - Typed collection refs in $lookup (refactoring-safe cross-collection joins)
 */
import { param, ctx } from "@vexnor/core";
import { collection } from "@vexnor/mongodb";

// ─── Collection definitions with schema descriptors ──────────────────────────

interface IAccount {
   _id: string;
   status: "created" | "confirmed" | "deleted";
   email: string;
   name: { first: string; last: string };
   notes: string | null;
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
   }[];
   total: number;
   createdAt: Date;
   modifiedAt: Date;
}

interface IProduct {
   _id: string;
   label: string;
   price: number;
   discount: number | null;
   availability: { isAvailable: boolean; isPublished: boolean };
   tags: string[];
   createdAt: Date;
}

export const Accounts = collection<IAccount>("accounts", {
   source: "@vexnor/react-vite-ui:mongodb",
   schema: {
      _id: "string",
      status: "string",
      email: "string",
      name: { first: "string", last: "string" },
      notes: "string",
      createdAt: "date",
      modifiedAt: "date",
   },
});

export const Orders = collection<IOrder>("orders", {
   source: "@vexnor/react-vite-ui:mongodb",
   schema: {
      _id: "string",
      status: "string",
      accountId: "string",
      items: [{ productId: "string", label: "string", productPrice: "number", discountPrice: "number", quantity: "integer" }],
      total: "number",
      createdAt: "date",
      modifiedAt: "date",
   },
});

export const Products = collection<IProduct>("products", {
   source: "@vexnor/react-vite-ui:mongodb",
   schema: {
      _id: "string",
      label: "string",
      price: "number",
      discount: "number",
      availability: { isAvailable: "boolean", isPublished: "boolean" },
      tags: ["string"],
      createdAt: "date",
   },
});

// ─── Queries ─────────────────────────────────────────────────────────────────

/** List accounts with optional text filter and pagination */
export const selectAccounts = Accounts.find(
   { status: param<{ status: string }>("status") },
   { sort: { createdAt: -1 }, limit: param<{ limit: number }>("limit"), skip: param<{ skip: number }>("skip") },
);

/** Get the authenticated user's account (ctx = server-injected, never client-supplied) */
export const selectMyAccount = Accounts.find({ _id: ctx<{ userId: string }>("userId") });

/** My orders — uses ctx() so the server injects userId from session */
export const selectMyOrders = Orders.aggregate([
   { $match: { accountId: ctx<{ userId: string }>("userId") } },
   { $sort: { createdAt: -1 } },
   { $limit: 20 },
]);

/** Order count per account — dashboard aggregate */
export const orderCountByAccount = Orders.aggregate<{ _id: string; orderCount: number; totalRevenue: number }>([
   { $group: { _id: "$accountId", orderCount: { $sum: 1 }, totalRevenue: { $sum: "$total" } } },
   { $sort: { totalRevenue: -1 } },
]);

/**
 * Orders with account info — $lookup using TYPED COLLECTION REF.
 * The `from: Accounts` is resolved to "accounts" at runtime, but gives:
 * - Type safety: foreignField is constrained to IAccount fields
 * - Refactoring: rename the collection, all references update
 * - Source tracking: framework knows this query touches both collections
 */
export const ordersWithAccount = Orders.aggregate<IOrder & { account: IAccount[] }>([
   { $match: { status: param<{ status: string }>("status") } },
   { $sort: { createdAt: -1 } },
   { $limit: 10 },
   { $lookup: { from: Accounts, localField: "accountId", foreignField: "_id", as: "account" } },
]);

/** Available products with tag filter */
export const selectProducts = Products.find(
   { "availability.isAvailable": true, tags: { $in: [param<{ tag: string }>("tag")] } },
   { sort: { price: 1 }, limit: param<{ limit: number }>("limit") },
);

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Insert a new account */
export const insertAccount = Accounts.insertOne(param<{ doc: IAccount }>("doc"));

/** Update account status */
export const updateAccountStatus = Accounts.updateOne(
   { _id: param<{ id: string }>("id") },
   { $set: { status: param<{ newStatus: string }>("newStatus"), modifiedAt: new Date() } },
);

/** Delete account by ID */
export const deleteAccount = Accounts.deleteOne({ _id: param<{ id: string }>("id") });

// ─── Export map for registry registration ────────────────────────────────────

export const queries = {
   selectAccounts,
   selectMyAccount,
   selectMyOrders,
   orderCountByAccount,
   ordersWithAccount,
   selectProducts,
   insertAccount,
   updateAccountStatus,
   deleteAccount,
};
