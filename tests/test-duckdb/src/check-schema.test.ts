import { describe, expect, test } from "vitest";
import { VexnorDuckDB } from "@vexnor/duckdb";
import { DUCKDB_PATH } from "./config.js";

describe("DuckDB schema and codegen", () => {
   test("discovers the complete comparable e2e schema", async () => {
      const schema = await new VexnorDuckDB().getSchema({ mode: "file", path: DUCKDB_PATH, schemas: ["main"] });

      expect({
         enums: schema.enums.map(({ enum_name, enum_values }) => ({ enum_name, values: enum_values.map(({ enum_label }) => enum_label) })),
         tables: schema.tables.map(({ table_name, table_type, primary_keys, foreign_keys }) => ({
            table_name,
            table_type,
            primaryKeys: primary_keys.map(({ column_name }) => column_name),
            foreignKeys: foreign_keys?.map(({ column_name, referenced_table_name, referenced_column_name }) => ({
               column_name,
               referenced_table_name,
               referenced_column_name,
            })) ?? [],
         })),
      }).toMatchInlineSnapshot(`
        {
          "enums": [
            {
              "enum_name": "account_status",
              "values": [
                "created",
                "confirmed",
                "deleted",
              ],
            },
            {
              "enum_name": "order_status",
              "values": [
                "created",
                "paid",
                "delivered",
                "received",
              ],
            },
          ],
          "tables": [
            {
              "foreignKeys": [
                {
                  "column_name": "parent_id",
                  "referenced_column_name": "account_id",
                  "referenced_table_name": "account",
                },
              ],
              "primaryKeys": [
                "account_id",
              ],
              "table_name": "account",
              "table_type": "table",
            },
            {
              "foreignKeys": [],
              "primaryKeys": [],
              "table_name": "account_order_summary",
              "table_type": "view",
            },
            {
              "foreignKeys": [],
              "primaryKeys": [
                "document_id",
              ],
              "table_name": "document_order",
              "table_type": "table",
            },
            {
              "foreignKeys": [
                {
                  "column_name": "account_id",
                  "referenced_column_name": "account_id",
                  "referenced_table_name": "account",
                },
              ],
              "primaryKeys": [
                "order_id",
              ],
              "table_name": "order",
              "table_type": "table",
            },
            {
              "foreignKeys": [
                {
                  "column_name": "product_id",
                  "referenced_column_name": "product_id",
                  "referenced_table_name": "product",
                },
                {
                  "column_name": "order_id",
                  "referenced_column_name": "order_id",
                  "referenced_table_name": "order",
                },
              ],
              "primaryKeys": [
                "order_id",
                "product_id",
              ],
              "table_name": "order_item",
              "table_type": "table",
            },
            {
              "foreignKeys": [],
              "primaryKeys": [
                "product_id",
              ],
              "table_name": "product",
              "table_type": "table",
            },
            {
              "foreignKeys": [],
              "primaryKeys": [
                "col_uuid",
              ],
              "table_name": "type_coverage",
              "table_type": "table",
            },
          ],
        }
      `);
   });

   test("uses declared enum names and preserves table/view mutability", async () => {
      const schema = await new VexnorDuckDB().getSchema({ mode: "file", path: DUCKDB_PATH, schemas: ["main"] });
      const account = schema.tables.find(({ table_name }) => table_name === "account")!;
      const view = schema.tables.find(({ table_name }) => table_name === "account_order_summary")!;

      expect({
         accountStatusUdt: account.columns.find(({ column_name }) => column_name === "status")!.udt_name,
         accountUpdatable: [...new Set(account.columns.map(({ is_updatable }) => is_updatable))],
         viewUpdatable: [...new Set(view.columns.map(({ is_updatable }) => is_updatable))],
      }).toMatchInlineSnapshot(`
        {
          "accountStatusUdt": "account_status",
          "accountUpdatable": [
            "YES",
          ],
          "viewUpdatable": [
            "NO",
          ],
        }
      `);
   });
});
