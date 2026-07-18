import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { val } from "#src/core/query/sql-select-value.js";
import { newSqlTable } from "#src/core/schema/sql-table.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";

describe("SqlQuery.sources", () => {
   const BillingAccount = newSqlTable<{
      Select: { id: string; email: string };
      Source: "app:billing";
   }>({
      tableInfo: { name: "account", schema: "billing" },
      pk: ["id"],
      source: "app:billing",
      columns: { id: "id", email: "email" },
      crud: { select: true, insert: false, update: false, delete: false },
   });

   const WarehouseOrder = newSqlTable<{
      Select: { id: string; accountId: string };
      Source: "app:warehouse";
   }>({
      tableInfo: { name: "order", schema: "warehouse" },
      pk: ["id"],
      source: "app:warehouse",
      columns: { id: "id", accountId: "account_id" },
      crud: { select: true, insert: false, update: false, delete: false },
   });

   test("single table — single source", () => {
      const query = sql`SELECT ${row(BillingAccount.$$)} FROM ${BillingAccount}`;
      expect(query.sources).toEqual(new Set(["app:billing"]));
   });

   test("two tables same source — single source", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}`;
      expect(query.sources).toEqual(new Set(["@vexnor/test:models"]));
   });

   test("two tables different sources — multiple sources", () => {
      const query = sql`SELECT ${row(BillingAccount.$$)} FROM ${BillingAccount} JOIN ${WarehouseOrder} ON ${WarehouseOrder.$accountId} = ${BillingAccount.$id}`;
      expect(query.sources).toEqual(new Set(["app:billing", "app:warehouse"]));
   });

   test("subquery propagates sources to parent", () => {
      const sub = sql`SELECT ${row(WarehouseOrder.$$)} FROM ${WarehouseOrder}`;
      const parent = sql`SELECT * FROM ${sub}`;
      expect(parent.sources).toEqual(new Set(["app:warehouse"]));
   });

   test("subquery with different source merges into parent sources", () => {
      const sub = sql`SELECT ${row(WarehouseOrder.$$)} FROM ${WarehouseOrder}`;
      const parent = sql`SELECT * FROM ${BillingAccount} JOIN ${sub} ON 1=1`;
      expect(parent.sources).toEqual(new Set(["app:billing", "app:warehouse"]));
   });

   test("CTE via .out propagates sources", () => {
      const cte = sql`SELECT ${row(BillingAccount.$$)} FROM ${BillingAccount}`;
      const query = sql`WITH ${cte.render("with")} SELECT * FROM ${cte.out}`;
      expect(query.sources).toEqual(new Set(["app:billing"]));
   });

   test("inline subquery propagates sources", () => {
      const sub = sql`SELECT ${row(WarehouseOrder.$$)} FROM ${WarehouseOrder}`;
      const query = sql`SELECT * FROM ${sub.inline()}`;
      expect(query.sources).toEqual(new Set(["app:warehouse"]));
   });

   test("query with no tables has empty sources", () => {
      const query = sql`SELECT 1`;
      expect(query.sources).toEqual(new Set());
   });

   test("aliased table preserves source", () => {
      const Alias = BillingAccount.as("b");
      const query = sql`SELECT ${row(Alias.$$)} FROM ${Alias}`;
      expect(query.sources).toEqual(new Set(["app:billing"]));
   });

   test("row() with table columns propagates source", () => {
      const query = sql`SELECT ${row(BillingAccount.$id, BillingAccount.$email)} FROM ${BillingAccount}`;
      expect(query.sources).toEqual(new Set(["app:billing"]));
   });

   test("val() with subquery propagates source", () => {
      const sub = sql`SELECT count(*) FROM ${WarehouseOrder}`;
      const v = val(sub).as<{ orderCount: number }>("orderCount");
      const query = sql`SELECT ${row(v)} FROM ${BillingAccount}`;
      expect(query.sources).toEqual(new Set(["app:billing", "app:warehouse"]));
   });

   test("array of tables propagates all sources", () => {
      const tables = [BillingAccount, WarehouseOrder];
      const query = sql`SELECT * FROM ${tables}`;
      expect(query.sources).toEqual(new Set(["app:billing", "app:warehouse"]));
   });
});
