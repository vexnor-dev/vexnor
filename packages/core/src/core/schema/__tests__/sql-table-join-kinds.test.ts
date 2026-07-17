import { describe, expect, test } from "vitest";
import { newSqlTable, type SqlTableForeignKey } from "#src/core/schema/sql-table.js";
import { SqlTableJoin } from "#src/core/schema/sql-table-join.js";

function makeTable(name: string, columns: Record<string, string>, fk?: SqlTableForeignKey[]) {
   return newSqlTable<{ Select: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Delete: true; Source: "test" }>({
      crud: { select: true, insert: true, update: true, delete: true },
      tableInfo: { name, schema: "public", alias: null, out: false },
      pk: ["id"],
      source: "test",
      fk,
      columns: columns as never,
   });
}

describe("SqlTable.join() — join kinds", () => {
   const Payment = makeTable("payment", { id: "id", customerId: "customer_id", amount: "amount" });
   const Customer = makeTable("customer", { id: "id", customerId: "customer_id", name: "name" });
   const City = makeTable("city", { id: "id", cityId: "city_id", city: "city" });
   const Country = makeTable("country", { id: "id", countryId: "country_id", country: "country" });

   test("join with bare tables (default inner)", () => {
      const joined = Payment.join({ customer: Customer });
      expect(joined).toBeInstanceOf(SqlTableJoin);
      expect(joined.joinMap).toHaveProperty("customer");
      expect(joined.joinTypes).toMatchInlineSnapshot(`{}`);
   });

   test("join with tuple [Table, kind]", () => {
      const joined = Payment.join({
         customer: Customer,
         city: [City, "left"],
      });
      expect(joined.joinMap).toHaveProperty("customer");
      expect(joined.joinMap).toHaveProperty("city");
      expect(joined.joinTypes).toMatchInlineSnapshot(`
        {
          "city": "left",
        }
      `);
   });

   test("join with all tuple entries", () => {
      const joined = Payment.join({
         customer: [Customer, "left"],
         city: [City, "right"],
         country: [Country, "full"],
      });
      expect(joined.joinTypes).toMatchInlineSnapshot(`
        {
          "city": "right",
          "country": "full",
          "customer": "left",
        }
      `);
   });

   test("join with mixed bare and tuple entries", () => {
      const joined = Payment.join({
         customer: Customer,
         city: [City, "left"],
         country: Country,
      });
      expect(Object.keys(joined.joinMap)).toHaveLength(3);
      expect(joined.joinTypes).toMatchInlineSnapshot(`
        {
          "city": "left",
        }
      `);
   });

   test("join with cross join", () => {
      const joined = Payment.join({
         customer: [Customer, "cross"],
      });
      expect(joined.joinTypes).toMatchInlineSnapshot(`
        {
          "customer": "cross",
        }
      `);
   });

   test("joinMap contains actual table instances, not tuples", () => {
      const joined = Payment.join({
         customer: [Customer, "left"],
         city: City,
      });
      // joinMap should have the raw SqlTable, not the tuple
      expect(joined.joinMap.customer).toBe(Customer);
      expect(joined.joinMap.city).toBe(City);
   });
});
