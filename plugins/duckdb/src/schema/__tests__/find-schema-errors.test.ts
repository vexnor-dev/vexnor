import { describe, expect, test } from "vitest";
import { findSchema } from "#src/schema/find-schema.js";

type MetadataRows = {
   tables?: Record<string, unknown>[];
   columns?: Record<string, unknown>[];
   primaryKeys?: Record<string, unknown>[];
   foreignKeys?: Record<string, unknown>[];
   enums?: Record<string, unknown>[];
};

function findWithRows(rows: MetadataRows) {
   const connection = {
      async runAndReadAll(text: string) {
         const selected = text.includes("information_schema.tables") ? rows.tables
            : text.includes("information_schema.columns") ? rows.columns
            : text.includes("PRIMARY KEY") ? rows.primaryKeys
            : text.includes("referential_constraints") ? rows.foreignKeys
            : rows.enums;
         return {
            getRowObjectsJS() {
               return selected ?? [];
            },
         };
      },
   };
   return Reflect.apply(findSchema, undefined, [connection, ["main"]]);
}

const table = { table_schema: "main", table_name: "item", table_type: "BASE TABLE" };
const column = {
   table_schema: "main",
   table_name: "item",
   column_name: "id",
   data_type: "INTEGER",
   is_nullable: "NO",
   column_default: null,
   numeric_precision_radix: 2,
   ordinal_position: 1,
};

describe("findSchema metadata validation", () => {
   test("rejects malformed column metadata fields", async () => {
      const cases: MetadataRows[] = [
         { tables: [table], columns: [{ ...column, is_nullable: "MAYBE" }] },
         { tables: [table], columns: [{ ...column, column_name: 1 }] },
         { tables: [table], columns: [{ ...column, column_default: 1 }] },
         { tables: [table], columns: [{ ...column, ordinal_position: "first" }] },
      ];
      const errors: string[] = [];
      for (const rows of cases) {
         try {
            await findWithRows(rows);
         } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
         }
      }

      expect(errors).toMatchInlineSnapshot(`
        [
          "Unexpected DuckDB is_nullable value: MAYBE",
          "DuckDB metadata field 'column_name' must be a string",
          "DuckDB metadata field 'column_default' must be a string or null",
          "DuckDB metadata field 'ordinal_position' must be a number or null",
        ]
      `);
   });

   test("rejects malformed enum labels", async () => {
      const cases: MetadataRows[] = [
         { enums: [{ enum_schema: "main", enum_name: "state", labels: "open" }] },
         { enums: [{ enum_schema: "main", enum_name: "state", labels: ["open", 1] }] },
      ];
      const errors: string[] = [];
      for (const rows of cases) {
         try {
            await findWithRows(rows);
         } catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
         }
      }

      expect(errors).toMatchInlineSnapshot(`
        [
          "DuckDB enum labels must be strings",
          "DuckDB enum labels must be strings",
        ]
      `);
   });

   test("ignores metadata rows whose tables are outside the selected table set", async () => {
      await expect(findWithRows({
         columns: [column],
         primaryKeys: [{
            constraint_name: "item_pkey",
            table_schema: "main",
            table_name: "item",
            column_name: "id",
            ordinal_position: 1,
         }],
         foreignKeys: [{
            constraint_name: "item_parent_fkey",
            table_schema: "main",
            table_name: "item",
            column_name: "parent_id",
            referenced_table_schema: "main",
            referenced_table_name: "item",
            referenced_column_name: "id",
         }],
      })).resolves.toMatchInlineSnapshot(`
        {
          "enums": [],
          "tables": [],
        }
      `);
   });
});
