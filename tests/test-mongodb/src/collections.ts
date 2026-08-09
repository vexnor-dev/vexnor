/**
 * Collection definitions for e2e tests.
 * Matches the TestDataManager document shapes.
 */
import { collection } from "@vexnor/mongodb";
import type { TestAccount, TestProduct, TestOrder } from "./test-data-manager.js";

export const Accounts = collection<TestAccount>("accounts", {
   source: "@vexnor/test-mongodb:e2e",
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

export const Products = collection<TestProduct>("products", {
   source: "@vexnor/test-mongodb:e2e",
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

export const Orders = collection<TestOrder>("orders", {
   source: "@vexnor/test-mongodb:e2e",
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
