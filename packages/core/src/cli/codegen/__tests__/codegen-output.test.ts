import { beforeEach, describe, expect, test, vi } from "vitest";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { codegenCommand } from "#src/cli/codegen/codegen-command.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { loadPlugin } from "#src/load-plugin.js";
import { MockPlugin } from "#src/test/mock-plugin.js";
import { SqlColumnInfo, SqlColumnType } from "#src/plugin/plugin.js";
import { SqlLiteralType } from "#src/plugin/sql-literal.js";

vi.mock("#src/load-plugin.js", () => ({
   loadPlugin: vi.fn(),
}));

const COLUMN_TYPES: Record<string, SqlColumnType> = {
   account_id: { type: SqlLiteralType.String },
   email: { type: SqlLiteralType.String },
   status: { type: SqlLiteralType.Udt, udt: "account_status" },
   created_at: { type: SqlLiteralType.Date },
   score: { type: SqlLiteralType.Number },
   is_active: { type: SqlLiteralType.Boolean },
   metadata: { type: SqlLiteralType.Json },
};

class CodegenTestPlugin extends MockPlugin {
   override dialect = "postgres";

   constructor() {
      super({ name: "vexnor-codegen-test" });
   }

   override getColumnType(col: SqlColumnInfo): SqlColumnType {
      return COLUMN_TYPES[col.column_name] ?? { type: SqlLiteralType.String };
   }

   override getSchema() {
      return Promise.resolve({
         enums: [
            {
               enum_schema: "public",
               enum_name: "account_status",
               enum_values: [{ enum_label: "active" }, { enum_label: "suspended" }],
            },
         ],
         tables: [
            {
               table_schema: "public",
               table_name: "account",
               table_type: "table" as const,
               primary_keys: [{ constraint_name: "pk_account", column_name: "account_id", table_schema: "public", table_name: "account" }],
               columns: [
                  { table_schema: "public", table_name: "account", column_name: "account_id", udt_name: "uuid", data_type: "uuid", is_nullable: "NO" as const, is_updatable: "YES" as const, column_default: null },
                  { table_schema: "public", table_name: "account", column_name: "email", udt_name: "text", data_type: "text", is_nullable: "NO" as const, is_updatable: "YES" as const, column_default: null },
                  { table_schema: "public", table_name: "account", column_name: "status", udt_name: "account_status", data_type: "USER-DEFINED", is_nullable: "NO" as const, is_updatable: "YES" as const, column_default: "'active'" },
                  { table_schema: "public", table_name: "account", column_name: "created_at", udt_name: "timestamptz", data_type: "timestamp with time zone", is_nullable: "NO" as const, is_updatable: "YES" as const, column_default: "now()" },
                  { table_schema: "public", table_name: "account", column_name: "score", udt_name: "int4", data_type: "integer", is_nullable: "YES" as const, is_updatable: "YES" as const, column_default: null },
                  { table_schema: "public", table_name: "account", column_name: "is_active", udt_name: "bool", data_type: "boolean", is_nullable: "NO" as const, is_updatable: "YES" as const, column_default: null },
                  { table_schema: "public", table_name: "account", column_name: "metadata", udt_name: "jsonb", data_type: "jsonb", is_nullable: "YES" as const, is_updatable: "YES" as const, column_default: null },
               ],
            },
         ],
      });
   }
}

const testPlugin = new CodegenTestPlugin();

vi.mock("vexnor-codegen-test", () => ({ default: testPlugin }));

async function readOutputFiles(outDir: string): Promise<Record<string, string>> {
   const files = await readdir(outDir);
   const entries = await Promise.all(
      files.sort().map(async (name) => [name, await readFile(join(outDir, name), "utf8")] as const),
   );
   return Object.fromEntries(entries);
}

describe("codegenCommand output", () => {
   beforeEach(() => {
      vi.mocked(loadPlugin).mockResolvedValue({ plugin: testPlugin, path: "vexnor-codegen-test" });
   });

   test("generates correct output for a table with enums", async () => {
      const outDir = join(__dirname, ".tmp-codegen-test");
      try {
         await mkdir(outDir, { recursive: true });
         await codegenCommand({
            plugin: "vexnor-codegen-test",
            schema: ["public"],
            uri: "test://localhost",
            outDir,
            camelCaseColumns: true,
         });

         const files = await readOutputFiles(outDir);

         expect(Object.keys(files)).toMatchInlineSnapshot(`
           [
             "index.ts",
             "public-enums.ts",
             "public.account-table.ts",
             "public.schema.ts",
           ]
         `);

         expect(files["public-enums.ts"]).toMatchInlineSnapshot(`
           "export const AccountStatusUdt = {
              ACTIVE: 'active',
              SUSPENDED: 'suspended',
           } as const;
           export type AccountStatusUdt = (typeof AccountStatusUdt)[keyof typeof AccountStatusUdt];
           "
         `);
         expect(files["public.account-table.ts"]).toMatchInlineSnapshot(`
           "/*
            File generated by Vexnor. Do not edit! 
           */
           import * as vexnor from "@vexnor/core";
           import * as udt from "./public-enums.js";

           export const Account = vexnor.newSqlTable<{
              Select: IAccountSelect;
              Insert: IAccountInsert;
              Update: IAccountUpdate;
              Delete: true;
           }>( {
              crud: {
                 select: true,
                 insert: true,
                 update: true,
                 delete: true,
              },
              tableInfo: {
                 name: "account",
                 schema: "public",
              },
              pk: ["accountId"],
              dialect: "postgres",
              source: "@vexnor/core:src/cli/codegen/__tests__/.tmp-codegen-test",
              columns: {

                 /**
                  * account_id uuid
                  */
                 accountId: "account_id",

                 /**
                  * email text
                  */
                 email: "email",

                 /**
                  * status account_status default 'active'
                  */
                 status: "status",

                 /**
                  * created_at timestamptz default now()
                  */
                 createdAt: "created_at",

                 /**
                  * score int4
                  */
                 score: "score",

                 /**
                  * is_active bool
                  */
                 isActive: "is_active",

                 /**
                  * metadata jsonb
                  */
                 metadata: "metadata",
              },
              jsonSchema: {
                 createdAt: "Date",
              },
              dbSchema: {
                 accountId: { dbType: "uuid", type: vexnor.SqlLiteralType.String },
                 email: { dbType: "text", type: vexnor.SqlLiteralType.String },
                 status: { dbType: "account_status", type: vexnor.SqlLiteralType.Udt, default: "'active'", values: ["active", "suspended"] },
                 createdAt: { dbType: "timestamptz", type: vexnor.SqlLiteralType.Date, default: "now()" },
                 score: { dbType: "int4", type: vexnor.SqlLiteralType.Number, nullable: true },
                 isActive: { dbType: "bool", type: vexnor.SqlLiteralType.Boolean },
                 metadata: { dbType: "jsonb", type: vexnor.SqlLiteralType.Json, nullable: true },
              },
           });
           export type IAccountInsert = {
              accountId: string;
              email: string;
              status?: udt.AccountStatusUdt;
              createdAt?: Date;
              score?: number | null;
              isActive: boolean;
              metadata?: unknown | null;
           };

           export type IAccountUpdate = Partial<IAccountInsert>;

           export type IAccountSelect = {
              accountId: string;
              email: string;
              status: udt.AccountStatusUdt;
              createdAt: Date;
              score: number | null;
              isActive: boolean;
              metadata: unknown | null;
           };

           export type IAccountJson = vexnor.JsonRow<IAccountSelect>;"
         `);
         expect(files["public.schema.ts"]).toMatchInlineSnapshot(`
           "export * from "./public.account-table.js";
           export * from "./public-enums.js";

           "
         `);
         expect(files["index.ts"]).toMatchInlineSnapshot(`
           "export * as public from "./public.schema.js";
           "
         `);
      } finally {
         await rm(outDir, { recursive: true, force: true });
      }
   });

   test("generates correct output without camelCase or pascalCase", async () => {
      const outDir = join(__dirname, ".tmp-codegen-test-nocase");
      try {
         await mkdir(outDir, { recursive: true });
         await codegenCommand({
            plugin: "vexnor-codegen-test",
            schema: ["public"],
            uri: "test://localhost",
            outDir,
         });

         const files = await readOutputFiles(outDir);
         expect(files["public.account-table.ts"]).toMatchInlineSnapshot(`
           "/*
            File generated by Vexnor. Do not edit! 
           */
           import * as vexnor from "@vexnor/core";
           import * as udt from "./public-enums.js";

           export const Account = vexnor.newSqlTable<{
              Select: IAccountSelect;
              Insert: IAccountInsert;
              Update: IAccountUpdate;
              Delete: true;
           }>( {
              crud: {
                 select: true,
                 insert: true,
                 update: true,
                 delete: true,
              },
              tableInfo: {
                 name: "account",
                 schema: "public",
              },
              pk: ["account_id"],
              dialect: "postgres",
              source: "@vexnor/core:src/cli/codegen/__tests__/.tmp-codegen-test-nocase",
              columns: {

                 /**
                  * account_id uuid
                  */
                 account_id: "account_id",

                 /**
                  * email text
                  */
                 email: "email",

                 /**
                  * status account_status default 'active'
                  */
                 status: "status",

                 /**
                  * created_at timestamptz default now()
                  */
                 created_at: "created_at",

                 /**
                  * score int4
                  */
                 score: "score",

                 /**
                  * is_active bool
                  */
                 is_active: "is_active",

                 /**
                  * metadata jsonb
                  */
                 metadata: "metadata",
              },
              jsonSchema: {
                 created_at: "Date",
              },
              dbSchema: {
                 account_id: { dbType: "uuid", type: vexnor.SqlLiteralType.String },
                 email: { dbType: "text", type: vexnor.SqlLiteralType.String },
                 status: { dbType: "account_status", type: vexnor.SqlLiteralType.Udt, default: "'active'", values: ["active", "suspended"] },
                 created_at: { dbType: "timestamptz", type: vexnor.SqlLiteralType.Date, default: "now()" },
                 score: { dbType: "int4", type: vexnor.SqlLiteralType.Number, nullable: true },
                 is_active: { dbType: "bool", type: vexnor.SqlLiteralType.Boolean },
                 metadata: { dbType: "jsonb", type: vexnor.SqlLiteralType.Json, nullable: true },
              },
           });
           export type IAccountInsert = {
              account_id: string;
              email: string;
              status?: udt.AccountStatusUdt;
              created_at?: Date;
              score?: number | null;
              is_active: boolean;
              metadata?: unknown | null;
           };

           export type IAccountUpdate = Partial<IAccountInsert>;

           export type IAccountSelect = {
              account_id: string;
              email: string;
              status: udt.AccountStatusUdt;
              created_at: Date;
              score: number | null;
              is_active: boolean;
              metadata: unknown | null;
           };

           export type IAccountJson = vexnor.JsonRow<IAccountSelect>;"
         `);
      } finally {
         await rm(outDir, { recursive: true, force: true });
      }
   });
});
