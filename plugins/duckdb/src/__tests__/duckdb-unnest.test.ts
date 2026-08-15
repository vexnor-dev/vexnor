import { describe, expect, expectTypeOf, test } from "vitest";
import { newSqlTable, row, SqlLiteralType, TypeOf } from "@vexnor/core";
import { sql, unnest } from "#src/index.js";

const Orders = newSqlTable<{
   Select: {
      items: Array<{
         product: { productId: string } | null;
         discounts: Array<{ code: string; amount: number } | null> | null;
      } | null>;
   };
   Insert: Record<string, never>;
   Update: Record<string, never>;
   Delete: true;
   Source: "duckdb-unnest-test";
}>({
   crud: { select: true, insert: true, update: true, delete: true },
   tableInfo: { name: "orders", schema: "main" },
   pk: [],
   dialect: "duckdb",
   source: "duckdb-unnest-test",
   columns: { items: "items" },
   dbSchema: {
      items: {
         dbType: "STRUCT(product STRUCT(product_id VARCHAR), discounts STRUCT(code VARCHAR, amount DOUBLE)[])[]",
         type: SqlLiteralType.Json,
         structure: {
            kind: "list",
            value: {
               kind: "struct",
               fields: {
                  product: {
                     fieldName: "product",
                     structure: {
                        kind: "struct",
                        fields: { productId: { fieldName: "product_id" } },
                     },
                  },
                  discounts: {
                     fieldName: "discounts",
                     structure: {
                        kind: "list",
                        value: {
                           kind: "struct",
                           fields: {
                              code: { fieldName: "code" },
                              amount: { fieldName: "amount" },
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

const UntypedStructure = newSqlTable<{
   Select: { values: Array<{ value: string }> };
   Insert: Record<string, never>;
   Update: Record<string, never>;
   Delete: true;
   Source: "duckdb-unnest-test";
}>({
   crud: { select: true, insert: true, update: true, delete: true },
   tableInfo: { name: "untyped_structure", schema: "main" },
   pk: [],
   dialect: "duckdb",
   source: "duckdb-unnest-test",
   columns: { values: "values" },
});

describe("unnest", () => {
   test("renders and types nested list relations", () => {
      const Items = unnest(Orders.$items).as("item");
      const Discounts = unnest(Items.$discounts).as("discount");
      const query = sql`
         select ${row(
            Items.$product.$productId.as("productId"),
            Discounts.$code,
            Discounts.$amount,
         )}
         from ${Orders}, ${Items}, ${Discounts}
      `;

      expectTypeOf<TypeOf<typeof query>>().toEqualTypeOf<{
         productId: string | null;
         code: string;
         amount: number;
      }>();
      expect(query.getSql({ params: {} as never })).toMatchInlineSnapshot(`
        {
          "text": "/* <query_0> */
        SELECT
          "item_row"."item"."product"."product_id" AS "productId",
          "discount_row"."discount"."code",
          "discount_row"."discount"."amount"
        FROM
          "main"."orders" AS "o_1",
          LATERAL unnest("o_1"."items") AS "item_row" ("item"),
          LATERAL unnest("item_row"."item"."discounts") AS "discount_row" ("discount")
          /* </query_0> */",
          "values": [],
        }
      `);
   });

   test("rejects non-list columns and unknown item fields", () => {
      const Items = unnest(Orders.$items).as("item");
      // eslint-disable-next-line no-constant-condition
      if (false) {
         // @ts-expect-error — product is a struct, not a list
         unnest(Items.$product);
         // @ts-expect-error — no generated unknown field exists
         void Items.$unknown;
      }

      expect([
         Reflect.get(Items, "plainProperty"),
         Reflect.get(Items, "$unknown"),
         Reflect.get(unnest(UntypedStructure.$values).as("value"), "$value"),
      ]).toMatchInlineSnapshot(`
        [
          undefined,
          undefined,
          undefined,
        ]
      `);
   });
});
