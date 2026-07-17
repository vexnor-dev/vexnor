/**
 * Generates cross-runtime MongoDB manifest and expected results.
 *
 * Run: npx tsx stacks/fixtures/generate-mongodb-manifest.ts
 */
import { param, ctx } from "@vexnor/core";
import { collection, serializeMongoManifest } from "@vexnor/mongodb";
import { mkdirSync, writeFileSync } from "node:fs";

// ─── Test collection definitions ─────────────────────────────────────────────

const accounts = collection("accounts", {
   source: "@vexnor/test:fixtures",
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

const orders = collection("orders", {
   source: "@vexnor/test:fixtures",
   schema: {
      _id: "string",
      status: "string",
      accountId: "string",
      items: [{ productId: "string", label: "string", productPrice: "number", quantity: "integer" }],
      createdAt: "date",
      modifiedAt: "date",
   },
});

// ─── Define test queries ─────────────────────────────────────────────────────

const queries = {
   // Simple find with literal filter
   findConfirmed: accounts.find({ status: "confirmed" }),

   // Find with param
   findByStatus: accounts.find({ status: param<{ status: string }>("status") }),

   // Find with ctx
   findById: accounts.find({ _id: ctx<{ userId: string }>("userId") }),

   // Find with sort + limit
   findRecent: accounts.find(
      {},
      { sort: { createdAt: -1 }, limit: param<{ limit: number }>("limit") },
   ),

   // Find with skip
   findPaginated: accounts.find(
      { status: param<{ status: string }>("status") },
      { sort: { createdAt: -1 }, limit: param<{ limit: number }>("limit"), skip: param<{ skip: number }>("skip") },
   ),

   // Aggregation — simple match + group
   ordersByStatus: orders.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
   ]),

   // Aggregation with param
   ordersByStatusParam: orders.aggregate([
      { $match: { status: param<{ status: string }>("status") } },
      { $group: { _id: "$accountId", total: { $sum: 1 } } },
   ]),

   // Aggregation with $lookup
   ordersWithAccounts: orders.aggregate([
      { $lookup: { from: "accounts", localField: "accountId", foreignField: "_id", as: "account" } },
   ]),

   // Delete with param
   deleteById: accounts.deleteOne({ _id: param<{ id: string }>("id") }),

   // Update with param
   updateStatus: accounts.updateOne(
      { _id: param<{ id: string }>("id") },
      { $set: { status: param<{ status: string }>("status") } },
   ),

   // Insert with param
   insertAccount: accounts.insertOne(param<{ doc: unknown }>("doc")),
};

// ─── Generate manifest ───────────────────────────────────────────────────────

async function main() {
   const manifest = await serializeMongoManifest(queries);

   const outDir = "stacks/fixtures/manifests/mongodb";
   mkdirSync(outDir, { recursive: true });
   writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));

   console.log(`Generated MongoDB manifest with ${Object.keys(manifest.queries).length} queries`);
   console.log(`Output: ${outDir}/manifest.json`);

   for (const [hash, entry] of Object.entries(manifest.queries)) {
      console.log(`  ✓ ${entry.name} (${hash.slice(0, 8)}...)`);
   }
}

main().catch(console.error);
