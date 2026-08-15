import { describe, expect, expectTypeOf, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { TypeOf } from "#src/core/sql-base.js";
import { newSqlTable } from "#src/core/schema/sql-table.js";

const DocumentOrder = newSqlTable<{
   Select: {
      documentId: string;
      shipping: {
         address: {
            country: string;
            geo: { latitude: number };
         };
      } | null;
   };
   Insert: {
      documentId: string;
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
   tableInfo: { name: "document_order", schema: "main" },
   pk: ["documentId"],
   dialect: "duckdb",
   source: "@vexnor/test:nested-columns",
   columns: {
      documentId: "document_id",
      shipping: "shipping",
   },
   columnStructures: {
      shipping: {
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
});

describe("typed nested table columns", () => {
   test("renders generated nested identifiers and infers nullable result fields", () => {
      const Orders = DocumentOrder.as("orders");
      const query = sql`
         select ${row(
            Orders.$documentId.as("orderId"),
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
          "orders"."document_id" AS "orderId",
          "orders"."shipping"."address"."country" AS "shippingCountry",
          "orders"."shipping"."address"."geo"."latitude" AS "shippingLatitude"
        FROM
          "main"."document_order" AS "orders"
          /* </query_0> */",
          "values": [],
        }
      `);
   });

   test("rejects nested identifiers that are absent from the generated type", () => {
      // eslint-disable-next-line no-constant-condition
      if (false) {
         // @ts-expect-error — address has no generated city field
         void DocumentOrder.$shipping.$address.$city;
      }

      expect(true).toBe(true);
   });

   test("exposes stable nested path metadata", () => {
      const country = DocumentOrder.$shipping.$address.$country;
      expect([
         country.path,
         DocumentOrder.$shipping.structure?.kind,
         country === DocumentOrder.$shipping.$address.$country,
         Reflect.get(DocumentOrder.$documentId, "$value"),
         Reflect.get(DocumentOrder.$shipping, "$missing"),
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
