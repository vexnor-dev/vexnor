/**
 * MongoDB query definitions for the React Vite API example.
 *
 * Demonstrates the vexnor MongoDB plugin DX:
 * - collection<T>() with schema descriptor
 * - find with param/ctx
 * - aggregate pipelines
 * - mutations (insert, update, delete)
 */
import { param, ctx } from "@vexnor/core";
import { collection } from "@vexnor/mongodb";

// ─── Collection definitions ──────────────────────────────────────────────────

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
      quantity: number;
   }[];
   createdAt: Date;
   modifiedAt: Date;
}

const accounts = collection<IAccount>("accounts", {
   source: "@vexnor/example-react-vite-api:mongodb",
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

const orders = collection<IOrder>("orders", {
   source: "@vexnor/example-react-vite-api:mongodb",
   schema: {
      _id: "string",
      status: "string",
      accountId: "string",
      items: [{ productId: "string", label: "string", productPrice: "number", quantity: "integer" }],
      createdAt: "date",
      modifiedAt: "date",
   },
});

// ─── Query definitions ───────────────────────────────────────────────────────

/** Find accounts with optional status filter */
export const findAccounts = accounts.find(
   { status: param<{ status: string }>("status") },
   { sort: { createdAt: -1 }, limit: param<{ limit: number }>("limit") },
);

/** Find a single account by ID (server-injected context) */
export const findMyAccount = accounts.find({ _id: ctx<{ userId: string }>("userId") });

/** Aggregation: order count per account */
export const orderCountByAccount = orders.aggregate<{ _id: string; orderCount: number }>([
   { $group: { _id: "$accountId", orderCount: { $sum: 1 } } },
   { $sort: { orderCount: -1 } },
]);

/** Aggregation: recent orders with account lookup */
export const recentOrdersWithAccount = orders.aggregate([
   { $match: { status: param<{ status: string }>("status") } },
   { $sort: { createdAt: -1 } },
   { $limit: 10 },
   { $lookup: { from: "accounts", localField: "accountId", foreignField: "_id", as: "account" } },
]);

/** Delete an account by ID */
export const deleteAccount = accounts.deleteOne({ _id: param<{ id: string }>("id") });

/** Insert a new account */
export const insertAccount = accounts.insertOne(param<{ doc: IAccount }>("doc"));

/** Update account status */
export const updateAccountStatus = accounts.updateOne(
   { _id: param<{ id: string }>("id") },
   { $set: { status: param<{ status: string }>("status"), modifiedAt: new Date() } },
);

export const queries = {
   findAccounts,
   findMyAccount,
   orderCountByAccount,
   recentOrdersWithAccount,
   deleteAccount,
   insertAccount,
   updateAccountStatus,
};
