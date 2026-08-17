import { describe, expect, test, vi, beforeEach } from "vitest";
import { CodeWriter } from "#src/lib/code-writer.js";
import { writeTableInsert } from "#src/cli/codegen/tables/write-table-insert.js";
import { writeTableSelect } from "#src/cli/codegen/tables/write-table-select.js";
import { writeTableType } from "#src/cli/codegen/tables/write-table-type.js";
import { CodegenContext, CodegenContextModel } from "#src/cli/codegen/codegen-context.js";
import { SqlLiteralType, type SqlColumnInfo, type SqlColumnType, type SqlTableInfo } from "#src/plugin/plugin.js";
import { createSchemaCatalog, type SchemaCatalogObject } from "#src/schema/schema-catalog.js";

const mockPlugin = {
   name: "@vexnor/test",
   version: "1.0.0-test",
   driver: "test",
   dialect: "postgresql",
   getColumnType: vi.fn<(column: SqlColumnInfo) => SqlColumnType>(),
};

function makeContext(opts = {}) {
   return new CodegenContextModel({
      outDir: "/tmp",
      plugin: mockPlugin as never,
      camelCaseColumns: true,
      includeEnums: true,
      generate: null,
      ...opts,
   });
}

function runInContext<T>(fn: () => T): T {
   return CodegenContext.run(makeContext(), fn);
}

interface TestTable {
   table_name: string;
   table_schema: string;
   table_type: string;
   primary_keys: { column_name: string }[];
   columns: {
      column_name: string;
      is_nullable: string;
      column_default: string | null;
      udt_name?: string;
      data_type?: string;
   }[];
   foreign_keys?: {
      constraint_name: string;
      column_name: string;
      table_schema: string;
      table_name: string;
      referenced_table_schema: string;
      referenced_table_name: string;
      referenced_column_name: string;
   }[];
}

const baseTable: TestTable = {
   table_name: "accounts",
   table_schema: "public",
   table_type: "table",
   primary_keys: [{ column_name: "account_id" }],
   columns: [
      { column_name: "account_id", is_nullable: "NO", column_default: null, udt_name: "uuid" },
      { column_name: "email", is_nullable: "NO", column_default: null, udt_name: "varchar" },
      { column_name: "created_at", is_nullable: "NO", column_default: "now()", udt_name: "timestamptz" },
      { column_name: "status", is_nullable: "YES", column_default: null, udt_name: "account_status" },
      { column_name: "data", is_nullable: "YES", column_default: null, udt_name: "jsonb" },
      { column_name: "avatar", is_nullable: "YES", column_default: null, udt_name: "bytea" },
      { column_name: "is_active", is_nullable: "NO", column_default: null, udt_name: "bit" },
      { column_name: "score", is_nullable: "NO", column_default: null, udt_name: "int4" },
   ],
};

function catalogTable(table: TestTable): SchemaCatalogObject {
   const schemaTable: SqlTableInfo = {
      table_name: table.table_name,
      table_schema: table.table_schema,
      table_type: table.table_type === "view" ? "view" : "table",
      columns: table.columns.map((column, index) => ({
         column_default: column.column_default,
         column_name: column.column_name,
         is_nullable: column.is_nullable === "YES" ? "YES" : "NO",
         is_updatable: table.table_type === "view" ? "NO" : "YES",
         ordinal_position: index + 1,
         table_name: table.table_name,
         table_schema: table.table_schema,
         udt_name: column.udt_name,
         ...("data_type" in column ? { data_type: column.data_type } : {}),
      })),
      primary_keys: table.primary_keys.map((primaryKey, index) => ({
         constraint_name: `pk_${table.table_name}`,
         column_name: primaryKey.column_name,
         ordinal_position: index + 1,
         table_name: table.table_name,
         table_schema: table.table_schema,
      })),
      foreign_keys: table.foreign_keys ?? [],
   };

   return createSchemaCatalog({
      plugin: mockPlugin,
      schema: { enums: [], tables: [schemaTable] },
      naming: { camelCaseColumns: true },
   }).objects[0]!;
}

describe("writeTableInsert — branch coverage", () => {
   beforeEach(() => {
      mockPlugin.getColumnType.mockReset().mockReturnValue({ type: SqlLiteralType.String });
   });

   test("skips views", () => {
      const writer = new CodeWriter();
      runInContext(() => writeTableInsert(writer, { table: catalogTable({ ...baseTable, table_type: "view" }) }));
      expect(writer.toString()).toBe("");
   });

   test("writes all column type branches", () => {
      mockPlugin.getColumnType
         .mockReturnValueOnce({ type: "string" }) // account_id
         .mockReturnValueOnce({ type: "string" }) // email
         .mockReturnValueOnce({ type: SqlLiteralType.Date }) // created_at
         .mockReturnValueOnce({ type: SqlLiteralType.Udt, udt: "account_status" }) // status
         .mockReturnValueOnce({ type: SqlLiteralType.Json }) // data
         .mockReturnValueOnce({ type: SqlLiteralType.Buffer }) // avatar
         .mockReturnValueOnce({ type: SqlLiteralType.Bit }) // is_active
         .mockReturnValueOnce({ type: SqlLiteralType.Custom, tsTypeSelect: "number", tsTypeInsert: "number | string" }); // score

      const writer = new CodeWriter();
      runInContext(() => writeTableInsert(writer, { table: catalogTable(baseTable) }));
      const output = writer.toString();
      expect(output).toContain("IAccountsInsert");
      expect(output).toContain("Date");
      expect(output).toContain("AccountStatusUdt");
      expect(output).toContain("unknown");
      expect(output).toContain("Uint8Array");
      expect(output).toContain("vexnor.Bit");
      expect(output).toContain("number | string");
      expect(output).toContain("| null");
   });
});

describe("writeTableSelect — branch coverage", () => {
   beforeEach(() => {
      mockPlugin.getColumnType.mockReset().mockReturnValue({ type: SqlLiteralType.String });
   });

   test("writes all column type branches", () => {
      mockPlugin.getColumnType
         .mockReturnValueOnce({ type: "string" })
         .mockReturnValueOnce({ type: "string" })
         .mockReturnValueOnce({ type: SqlLiteralType.Date })
         .mockReturnValueOnce({ type: SqlLiteralType.Udt, udt: "account_status" })
         .mockReturnValueOnce({ type: SqlLiteralType.Json })
         .mockReturnValueOnce({ type: SqlLiteralType.Buffer })
         .mockReturnValueOnce({ type: SqlLiteralType.Bit })
         .mockReturnValueOnce({ type: SqlLiteralType.Custom, tsTypeSelect: "number" });

      const writer = new CodeWriter();
      runInContext(() => writeTableSelect(writer, { table: catalogTable(baseTable) }));
      const output = writer.toString();
      expect(output).toContain("IAccountsSelect");
      expect(output).toContain("Date");
      expect(output).toContain("AccountStatusUdt");
      expect(output).toContain("Uint8Array");
      expect(output).toContain("vexnor.Bit");
      expect(output).toContain("| null");
   });
});

describe("nested column code generation", () => {
   const nestedTable = {
      ...baseTable,
      columns: [
         {
            column_name: "shipping_details",
            is_nullable: "YES",
            column_default: null,
            udt_name: "STRUCT(address STRUCT(country VARCHAR, geo STRUCT(latitude DOUBLE)), tags VARCHAR[])",
         },
      ],
      primary_keys: [],
   };

   beforeEach(() => {
      mockPlugin.getColumnType.mockReset();
      mockPlugin.getColumnType.mockReturnValue({
         type: SqlLiteralType.Json,
         typeTree: {
            kind: "struct",
            fields: [
               {
                  name: "address",
                  value: {
                     kind: "struct",
                     fields: [
                        { name: "country", value: { kind: "scalar", type: SqlLiteralType.String } },
                        { name: "tracking_id", value: { kind: "scalar", type: SqlLiteralType.String } },
                        {
                           name: "geo",
                           value: {
                              kind: "struct",
                              fields: [{ name: "latitude", value: { kind: "scalar", type: SqlLiteralType.Number } }],
                           },
                        },
                     ],
                  },
               },
               {
                  name: "tags",
                  value: { kind: "list", value: { kind: "scalar", type: SqlLiteralType.String } },
               },
            ],
         },
      });
   });

   test("writes nested select and insert types", () => {
      const selectWriter = new CodeWriter();
      const insertWriter = new CodeWriter();
      runInContext(() => {
         const table = catalogTable(nestedTable);
         writeTableSelect(selectWriter, { table });
         writeTableInsert(insertWriter, { table });
      });

      expect(selectWriter.toString()).toMatchInlineSnapshot(`
        "
        export type IAccountsSelect = {
           shippingDetails:  {
              address:  {
                 country: string | null;
                 trackingId: string | null;
                 geo:  {
                    latitude: number | null;
                 } | null;
              } | null;
              tags: Array<string | null> | null;
           } | null;
        };

        export type IAccountsJson = vexnor.JsonRow<IAccountsSelect>;"
      `);
      expect(insertWriter.toString()).toMatchInlineSnapshot(`
        "
        export type IAccountsInsert = {
           shippingDetails?:  {
              address:  {
                 country: string | null;
                 tracking_id: string | null;
                 geo:  {
                    latitude: number | null;
                 } | null;
              } | null;
              tags: Array<string | null> | null;
           } | null;
        };

        export type IAccountsUpdate = Partial<IAccountsInsert>;
        "
      `);
   });

   test("writes nested runtime identifier metadata", () => {
      const writer = new CodeWriter();
      runInContext(() => writeTableType(writer, { table: catalogTable(nestedTable) }));
      expect(writer.toString()).toMatchInlineSnapshot(`
        "export const Accounts = vexnor.newSqlTable<{
           Select: IAccountsSelect;
           Insert: IAccountsInsert;
           Update: IAccountsUpdate;
           Delete: true;
           Source: "";
        }>( {
           crud: {
              select: true,
              insert: true,
              update: true,
              delete: true,
           },
           tableInfo: {
              name: "accounts",
              schema: "public",
           },
           pk: [],
           dialect: "postgresql",
           source: "",
           columns: {

              /**
               * shipping_details STRUCT(address STRUCT(country VARCHAR, geo STRUCT(latitude DOUBLE)), tags VARCHAR[])
               */
              shippingDetails: "shipping_details",
           },
           dbSchema: {
              shippingDetails: {
                 dbType: "STRUCT(address STRUCT(country VARCHAR, geo STRUCT(latitude DOUBLE)), tags VARCHAR[])",
                 type: vexnor.SqlLiteralType.Json,
                 nullable: true,
                 structure: {
                    kind: "struct",
                    fields: {
                       address: {
                          fieldName: "address",
                          structure: {
                             kind: "struct",
                             fields: {
                                country: {
                                   fieldName: "country",
                                },
                                trackingId: {
                                   fieldName: "tracking_id",
                                },
                                geo: {
                                   fieldName: "geo",
                                   structure: {
                                      kind: "struct",
                                      fields: {
                                         latitude: {
                                            fieldName: "latitude",
                                         },
                                      },
                                   },
                                },
                             },
                          },
                       },
                       tags: {
                          fieldName: "tags",
                          structure: {
                             kind: "list",
                             value: null,
                          },
                       },
                    },
                 },
              },
           },
        });"
      `);
   });
});

describe("writeTableType — branch coverage", () => {
   beforeEach(() => {
      mockPlugin.getColumnType.mockReset().mockReturnValue({ type: SqlLiteralType.String });
   });

   test("writes table type for regular table with Date columns", () => {
      mockPlugin.getColumnType
         .mockReturnValueOnce({ type: "string" })
         .mockReturnValueOnce({ type: "string" })
         .mockReturnValueOnce({ type: SqlLiteralType.Date })
         .mockReturnValueOnce({ type: "string" })
         .mockReturnValueOnce({ type: "string" })
         .mockReturnValueOnce({ type: "string" })
         .mockReturnValueOnce({ type: "string" })
         .mockReturnValueOnce({ type: "string" });

      const writer = new CodeWriter();
      runInContext(() => writeTableType(writer, { table: catalogTable(baseTable) }));
      const output = writer.toString();
      expect(output).toContain("newSqlTable");
      expect(output).toContain("Insert:");
      expect(output).toContain("Update:");
      expect(output).toContain("Delete: true");
      expect(output).toContain("jsonSchema:");
      expect(output).toContain('"Date"');
   });

   test("writes table type for view (no insert/update/delete)", () => {
      mockPlugin.getColumnType.mockReturnValue({ type: "string" });

      const viewTable = { ...baseTable, table_type: "view", primary_keys: [] };
      const writer = new CodeWriter();
      runInContext(() => writeTableType(writer, { table: catalogTable(viewTable) }));
      const output = writer.toString();
      expect(output).toContain("newSqlTable");
      expect(output).not.toContain("Insert:");
      expect(output).toContain("insert: false");
      expect(output).toContain("update: false");
      expect(output).toContain("delete: false");
   });

   test("writes table type with no primary keys and no Date columns", () => {
      mockPlugin.getColumnType.mockReturnValue({ type: "string" });

      const noPkTable = { ...baseTable, primary_keys: [] };
      const writer = new CodeWriter();
      runInContext(() => writeTableType(writer, { table: catalogTable(noPkTable) }));
      const output = writer.toString();
      expect(output).toContain("pk: []");
      expect(output).not.toContain("jsonSchema:");
   });

   test("writes table type with column_default values in JSDoc", () => {
      mockPlugin.getColumnType.mockReturnValue({ type: "string" });

      const tableWithDefaults = {
         ...baseTable,
         columns: [
            { column_name: "id", is_nullable: "NO", column_default: "gen_random_uuid()", udt_name: "uuid" },
            { column_name: "name", is_nullable: "NO", column_default: null, udt_name: "varchar" },
         ],
      };
      const writer = new CodeWriter();
      runInContext(() => writeTableType(writer, { table: catalogTable(tableWithDefaults) }));
      const output = writer.toString();
      expect(output).toContain("default gen_random_uuid()");
   });
});

describe("writeTableType — config flag branches", () => {
   beforeEach(() => {
      mockPlugin.getColumnType.mockReset().mockReturnValue({ type: SqlLiteralType.String });
   });

   test("always emits dbSchema", () => {
      mockPlugin.getColumnType.mockReturnValue({ type: "string" });

      const ctx = new CodegenContextModel({
         outDir: "/tmp",
         plugin: mockPlugin as never,
         camelCaseColumns: true,
         includeEnums: false,
         generate: null,
      });

      const writer = new CodeWriter();
      CodegenContext.run(ctx, () => writeTableType(writer, { table: catalogTable(baseTable) }));
      const output = writer.toString();
      expect(output).toContain("dbSchema:");
   });

   test("always emits fk when table has foreign keys", () => {
      mockPlugin.getColumnType.mockReturnValue({ type: "string" });

      const ctx = new CodegenContextModel({
         outDir: "/tmp",
         plugin: mockPlugin as never,
         camelCaseColumns: true,
         includeEnums: false,
         generate: null,
      });

      const tableWithFk = {
         ...baseTable,
         foreign_keys: [
            {
               constraint_name: "fk_test",
               column_name: "status",
               table_schema: "public",
               table_name: "accounts",
               referenced_table_schema: "public",
               referenced_table_name: "statuses",
               referenced_column_name: "id",
            },
         ],
      };

      const writer = new CodeWriter();
      CodegenContext.run(ctx, () => writeTableType(writer, { table: catalogTable(tableWithFk) }));
      const output = writer.toString();
      expect(output).toContain("fk:");
   });
});

describe("writeTableType — error handling", () => {
   test("propagates plugin column-type failures while building the catalog", () => {
      mockPlugin.getColumnType.mockImplementationOnce(() => {
         throw new Error("synthetic type mapping failure");
      });

      const ctx = new CodegenContextModel({
         outDir: "/tmp",
         plugin: mockPlugin as never,
         camelCaseColumns: true,
         includeEnums: false,
         generate: null,
      });

      expect(() => {
         CodegenContext.run(ctx, () => catalogTable(baseTable));
      }).toThrow("synthetic type mapping failure");
   });
});

describe("CodegenContextModel — defaults", () => {
   test("defaults source to empty string and enums to empty array when not provided", () => {
      const ctx = new CodegenContextModel({
         outDir: "/tmp",
         plugin: mockPlugin as never,
      });
      expect(ctx.source).toMatchInlineSnapshot(`""`);
      expect(ctx.enums).toMatchInlineSnapshot(`[]`);
   });

   test("uses provided source and enums when given", () => {
      const ctx = new CodegenContextModel({
         outDir: "/tmp",
         plugin: mockPlugin as never,
         source: "my-pkg:src/codegen",
         enums: [{ id: "public.status", schema: "public", name: "status", values: ["active"] }],
      });
      expect(ctx.source).toMatchInlineSnapshot(`"my-pkg:src/codegen"`);
      expect(ctx.enums).toHaveLength(1);
   });
});

describe("writeTableType — dbSchema edge cases", () => {
   beforeEach(() => {
      mockPlugin.getColumnType.mockReset().mockReturnValue({ type: SqlLiteralType.String });
   });

   test("handles column with no udt_name and no data_type", () => {
      mockPlugin.getColumnType.mockReturnValue({ type: "string" });

      const tableWithBareCol = {
         ...baseTable,
         columns: [
            {
               column_name: "bare_col",
               is_nullable: "NO",
               column_default: null,
               udt_name: undefined,
               data_type: undefined,
            },
         ],
         primary_keys: [],
      };

      const writer = new CodeWriter();
      runInContext(() => writeTableType(writer, { table: catalogTable(tableWithBareCol) }));
      const output = writer.toString();
      expect(output).toContain('dbType: "unknown"');
   });

   test("handles column with data_type but no udt_name", () => {
      mockPlugin.getColumnType.mockReturnValue({ type: "string" });

      const tableWithDataType = {
         ...baseTable,
         columns: [
            {
               column_name: "col",
               is_nullable: "NO",
               column_default: null,
               udt_name: undefined,
               data_type: "character varying",
            },
         ],
         primary_keys: [],
      };

      const writer = new CodeWriter();
      runInContext(() => writeTableType(writer, { table: catalogTable(tableWithDataType) }));
      const output = writer.toString();
      expect(output).toContain('dbType: "character varying"');
   });

   test("handles unknown SqlLiteralType value", () => {
      mockPlugin.getColumnType.mockReturnValue({ type: SqlLiteralType.Unknown });

      const table = {
         ...baseTable,
         columns: [
            { column_name: "col", is_nullable: "NO", column_default: null, udt_name: "custom", data_type: "custom" },
         ],
         primary_keys: [],
      };

      const writer = new CodeWriter();
      runInContext(() => writeTableType(writer, { table: catalogTable(table) }));
      const output = writer.toString();
      expect(output).toContain("SqlLiteralType.Unknown");
   });

   test("handles non-nullable column without default", () => {
      mockPlugin.getColumnType.mockReturnValue({ type: "string" });

      const table = {
         ...baseTable,
         columns: [{ column_name: "col", is_nullable: "NO", column_default: null, udt_name: "text" }],
         primary_keys: [],
      };

      const writer = new CodeWriter();
      runInContext(() => writeTableType(writer, { table: catalogTable(table) }));
      const output = writer.toString();
      expect(output).not.toContain("nullable:");
      expect(output).not.toContain("default:");
   });

   test("handles Udt type without udt field", () => {
      mockPlugin.getColumnType.mockReturnValue({ type: SqlLiteralType.Udt });

      const table = {
         ...baseTable,
         columns: [{ column_name: "col", is_nullable: "NO", column_default: null, udt_name: "my_type" }],
         primary_keys: [],
      };

      const writer = new CodeWriter();
      runInContext(() => writeTableType(writer, { table: catalogTable(table) }));
      const output = writer.toString();
      expect(output).toContain("SqlLiteralType.Udt");
      expect(output).not.toContain("values:");
   });
});

describe("resolveSource — fallback", () => {
   test("returns outDir when no package.json found anywhere", async () => {
      const { resolveSource } = await import("#src/cli/codegen/codegen-command.js");
      // /tmp has no package.json up to root
      const result = await resolveSource("/tmp/some-random-path");
      expect(result).toMatchInlineSnapshot(`"/tmp/some-random-path"`);
   });
});
