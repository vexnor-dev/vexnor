import { Given } from "@cucumber/cucumber";
import { TestWorld } from "../test-world.js";
import { ok } from "node:assert";
import { Account, Order } from "../codegen/one_sql.schema.js";

Given(/^Generated sql mapping code is available in current package$/, function (this: TestWorld) {
   ok(Account, "Account sql mapping type is not available");
   ok(Order, "Order sql mapping type is not available");
});
