import { describe, expect, expectTypeOf, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { TypeOf } from "#src/core/sql-base.js";
import { newSqlTable } from "#src/core/schema/sql-table.js";
import { SqlLiteralType } from "#src/plugin/sql-literal.js";

const Order = newSqlTable<{
   Select: {
      orderId: string;
      shipping: {
         address: {
            country: string;
            geo: { latitude: number };
         };
      } | null;
   };
   Insert: {
      orderId: string;
      shipping?: {
         address: {
            country: string;
            geo: { latitude: number };
         };
      } | null;
   };
   Update: Record<string, never>;
   Delete: true;
   Source: "@vexnor/test:nested-columns";
}>({
   crud: { select: true, insert: true, update: true, delete: true },
   tableInfo: { name: "order", schema: "main" },
   pk: ["orderId"],
   dialect: "duckdb",
   source: "@vexnor/test:nested-columns",
   columns: {
      orderId: "order_id",
      shipping: "shipping",
   },
   dbSchema: {
      shipping: {
         dbType: "STRUCT(address STRUCT(country VARCHAR, geo STRUCT(latitude DOUBLE)))",
         type: SqlLiteralType.Json,
         structure: {
            kind: "struct",
            fields: {
               address: {
                  fieldName: "address",
                  structure: {
                     kind: "struct",
                     fields: {
                        country: { fieldName: "country" },
                        geo: {
                           fieldName: "geo",
                           structure: {
                              kind: "struct",
                              fields: {
                                 latitude: { fieldName: "latitude" },
                              },
                           },
                        },
                     },
                  },
               },
            },
         },
      },
   },
});

describe("typed nested table columns", () => {
   test("renders generated nested identifiers and infers nullable result fields", () => {
      const Orders = Order.as("orders");
      const query = sql`
         select ${row(
            Orders.$orderId,
            Orders.$shipping.$address.$country.as("shippingCountry"),
            Orders.$shipping.$address.$geo.$latitude.as("shippingLatitude"),
         )}
         from ${Orders}
      `;

      expectTypeOf<TypeOf<typeof query>>().toEqualTypeOf<{
         orderId: string;
         shippingCountry: string | null;
         shippingLatitude: number | null;
      }>();

      expect(query.getSql({ params: {} as never, options: { dialect: "duckdb" } })).toMatchInlineSnapshot(`
        {
          "text": "/* <query_0> */
        SELECT
          "orders"."order_id" AS "orderId",
          "orders"."shipping"."address"."country" AS "shippingCountry",
          "orders"."shipping"."address"."geo"."latitude" AS "shippingLatitude"
        FROM
          "main"."order" AS "orders"
          /* </query_0> */",
          "values": [],
        }
      `);
   });

   test("rejects nested identifiers that are absent from the generated type", () => {
      // eslint-disable-next-line no-constant-condition
      if (false) {
         // @ts-expect-error — address has no generated city field
         void Order.$shipping.$address.$city;
      }

      expect(true).toBe(true);
   });

   test("exposes stable nested path metadata", () => {
      const country = Order.$shipping.$address.$country;
      expect([
         country.path,
         Order.$shipping.structure?.kind,
         country === Order.$shipping.$address.$country,
         Reflect.get(Order.$orderId, "$value"),
         Reflect.get(Order.$shipping, "$missing"),
      ]).toMatchInlineSnapshot(`
        [
          [
            "address",
            "country",
          ],
          "struct",
          true,
          undefined,
          undefined,
        ]
      `);
   });
});
