import { describe, expect, test, vi, beforeEach } from "vitest";
import { CodeWriter } from "#/lib/code-writer.js";
import { writeTableInsert } from "#/cli/codegen/tables/write-table-insert.js";
import { writeTableSelect } from "#/cli/codegen/tables/write-table-select.js";
import { writeTableType } from "#/cli/codegen/tables/write-table-type.js";
import { CodegenContext, CodegenContextModel } from "#/cli/codegen/codegen-context.js";
import { SqlLiteralType } from "#/plugin/plugin.js";

const mockPlugin = {
   dialect: "postgresql",
   getColumnType: vi.fn(),
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

const baseTable = {
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

describe("writeTableInsert — branch coverage", () => {
   beforeEach(() => {
      mockPlugin.getColumnType.mockReset();
   });

   test("skips views", () => {
      const writer = new CodeWriter();
      runInContext(() => writeTableInsert(writer, { table: { ...baseTable, table_type: "view" } as never }));
      expect(writer.toString()).toBe("");
   });

   test("writes all column type branches", () => {
      mockPlugin.getColumnType
         .mockReturnValueOnce({ type: "string" })  // account_id
         .mockReturnValueOnce({ type: "string" })  // email
         .mockReturnValueOnce({ type: SqlLiteralType.Date })  // created_at
         .mockReturnValueOnce({ type: SqlLiteralType.Udt, udt: "account_status" })  // status
         .mockReturnValueOnce({ type: SqlLiteralType.Json })  // data
         .mockReturnValueOnce({ type: SqlLiteralType.Buffer })  // avatar
         .mockReturnValueOnce({ type: SqlLiteralType.Bit })  // is_active
         .mockReturnValueOnce({ type: SqlLiteralType.Custom, tsTypeSelect: "number", tsTypeInsert: "number | string" });  // score

      const writer = new CodeWriter();
      runInContext(() => writeTableInsert(writer, { table: baseTable as never }));
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
      mockPlugin.getColumnType.mockReset();
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
      runInContext(() => writeTableSelect(writer, { table: baseTable as never }));
      const output = writer.toString();
      expect(output).toContain("IAccountsSelect");
      expect(output).toContain("Date");
      expect(output).toContain("AccountStatusUdt");
      expect(output).toContain("Uint8Array");
      expect(output).toContain("vexnor.Bit");
      expect(output).toContain("| null");
   });
});

describe("writeTableType — branch coverage", () => {
   beforeEach(() => {
      mockPlugin.getColumnType.mockReset();
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
      runInContext(() => writeTableType(writer, { table: baseTable as never }));
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
      runInContext(() => writeTableType(writer, { table: viewTable as never }));
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
      runInContext(() => writeTableType(writer, { table: noPkTable as never }));
      const output = writer.toString();
      expect(output).toContain('pk: []');
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
      runInContext(() => writeTableType(writer, { table: tableWithDefaults as never }));
      const output = writer.toString();
      expect(output).toContain("default gen_random_uuid()");
   });
});
