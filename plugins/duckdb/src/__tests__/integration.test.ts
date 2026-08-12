import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { DuckDBConnection } from "@duckdb/node-api";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { param, sql, val } from "@vexnor/core";
import { VexnorDuckDB } from "#src/vexnor-duckdb.js";
import "#src/duckdb-augment.js";

describe("DuckDB integration", () => {
   const plugin = new VexnorDuckDB();
   let db: DuckDBConnection;
   let close: () => Promise<void>;
   let directory: string;
   let path: string;

   beforeAll(async () => {
      directory = mkdtempSync(join(tmpdir(), "vexnor-duckdb-"));
      path = join(directory, "integration.duckdb");
      const connection = await plugin.createConnection({ config: { mode: "file", path } });
      db = connection.db;
      close = () => connection.close();
      await db.run(`
         create type account_status as enum ('active', 'disabled');
         create table account (
            account_id integer primary key,
            email varchar not null,
            active boolean not null,
            created_at timestamp not null,
            status account_status default 'active',
            parent_id integer references account(account_id)
         );
         create view active_account as select * from account where active;
      `);
   });

   afterAll(async () => {
      await close();
      rmSync(directory, { recursive: true, force: true });
   });

   test("executes parameterized writes and typed reads", async () => {
      await sql`
         insert into account (account_id, email, active, created_at)
         values (${param<{ id: number }>("id")}, ${param<{ email: string }>("email")}, true, timestamp '2026-08-10 12:00:00')
      `.duckdb.run({ db, params: { id: 1, email: "duck@example.com" } });

      const result = await sql`
         select ${val`account_id`.as<{ accountId: number }>("accountId")},
                ${val`email`.as<{ email: string }>("email")},
                ${val`active`.as<{ active: boolean }>("active")},
                ${val`created_at`.as<{ createdAt: Date }>("createdAt")}
         from account
         where account_id = ${param<{ id: number }>("id")}
      `.duckdb.one({ db, params: { id: 1 } });

      expect(result).toMatchInlineSnapshot(`
        {
          "accountId": 1,
          "active": true,
          "createdAt": 2026-08-10T12:00:00.000Z,
          "email": "duck@example.com",
        }
      `);
      expect(result.createdAt).toBeInstanceOf(Date);
   });

   test("queries CSV, JSON, and Parquet files directly", async () => {
      const csvPath = join(directory, "accounts.csv");
      const jsonPath = join(directory, "accounts.json");
      const parquetPath = join(directory, "accounts.parquet");
      writeFileSync(csvPath, "account_id,email\n2,csv@example.com\n", "utf8");
      writeFileSync(jsonPath, '{"account_id":3,"email":"json@example.com"}\n', "utf8");
      const escapedCsvPath = csvPath.replaceAll("'", "''");
      const escapedParquetPath = parquetPath.replaceAll("'", "''");
      await db.run(`copy (select * from read_csv_auto('${escapedCsvPath}')) to '${escapedParquetPath}' (format parquet)`);

      const result = await sql`
         select 'csv' as source, account_id as "accountId", email from read_csv_auto(${csvPath})
         union all
         select 'json' as source, account_id as "accountId", email from read_json_auto(${jsonPath})
         union all
         select 'parquet' as source, account_id as "accountId", email from read_parquet(${parquetPath})
         order by source
      `.duckdb.all({ db });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": 2n,
            "email": "csv@example.com",
            "source": "csv",
          },
          {
            "accountId": 3n,
            "email": "json@example.com",
            "source": "json",
          },
          {
            "accountId": 2n,
            "email": "csv@example.com",
            "source": "parquet",
          },
        ]
      `);
   });

   test("generates typed models through the Vexnor CLI", async () => {
      const codegenDatabasePath = join(directory, "codegen.duckdb");
      const connection = await plugin.createConnection({ config: { mode: "file", path: codegenDatabasePath } });
      await connection.db.run(`
         create type article_state as enum ('draft', 'published');
         create table article (
            article_id uuid primary key,
            title varchar not null,
            state article_state not null default 'draft',
            published_at timestamp
         );
      `);
      await connection.close();

      const repositoryRoot = resolve(import.meta.dirname, "../../../..");
      const outDir = join(repositoryRoot, "plugins/duckdb/.tmp-codegen-integration");
      mkdirSync(outDir, { recursive: true });
      try {
         execFileSync(process.execPath, [
            join(repositoryRoot, "packages/core/cli.mjs"),
            "codegen",
            "--plugin", "@vexnor/duckdb",
            "--schema", "main",
            "--uri", codegenDatabasePath,
            "--outDir", outDir,
            "--camelCaseColumns",
         ], { cwd: repositoryRoot, stdio: "pipe" });

         expect(readdirSync(outDir).sort()).toMatchInlineSnapshot(`
           [
             "index.ts",
             "main-enums.ts",
             "main.article-table.ts",
             "main.schema.ts",
           ]
         `);
         expect(readFileSync(join(outDir, "main.article-table.ts"), "utf8")).toMatchInlineSnapshot(`
           "/*
            File generated by Vexnor. Do not edit!
           */
           import * as vexnor from "@vexnor/core";
           import * as udt from "./main-enums.js";

           export const Article = vexnor.newSqlTable<{
              Select: IArticleSelect;
              Insert: IArticleInsert;
              Update: IArticleUpdate;
              Delete: true;
              Source: "@vexnor/duckdb:.tmp-codegen-integration";
           }>( {
              crud: {
                 select: true,
                 insert: true,
                 update: true,
                 delete: true,
              },
              tableInfo: {
                 name: "article",
                 schema: "main",
              },
              pk: ["articleId"],
              dialect: "duckdb",
              source: "@vexnor/duckdb:.tmp-codegen-integration",
              columns: {

                 /**
                  * article_id undefined
                  */
                 articleId: "article_id",

                 /**
                  * title undefined
                  */
                 title: "title",

                 /**
                  * state article_state default 'draft'
                  */
                 state: "state",

                 /**
                  * published_at undefined
                  */
                 publishedAt: "published_at",
              },
              jsonSchema: {
                 publishedAt: "Date",
              },
              dbSchema: {
                 articleId: { dbType: "UUID", type: vexnor.SqlLiteralType.String },
                 title: { dbType: "VARCHAR", type: vexnor.SqlLiteralType.String },
                 state: { dbType: "article_state", type: vexnor.SqlLiteralType.Udt, default: "'draft'", values: ["draft", "published"] },
                 publishedAt: { dbType: "TIMESTAMP", type: vexnor.SqlLiteralType.Date, nullable: true },
              },
           });
           export type IArticleInsert = {
              articleId: string;
              title: string;
              state?: udt.ArticleStateUdt;
              publishedAt?: Date | null;
           };

           export type IArticleUpdate = Partial<IArticleInsert>;

           export type IArticleSelect = {
              articleId: string;
              title: string;
              state: udt.ArticleStateUdt;
              publishedAt: Date | null;
           };

           export type IArticleJson = vexnor.JsonRow<IArticleSelect>;"
         `);
      } finally {
         rmSync(outDir, { recursive: true, force: true });
      }
   });

   test("introspects tables, primary keys, and columns", async () => {
      const schema = await plugin.getSchema({ mode: "file", path, schemas: ["main"] });
      expect(schema).toMatchInlineSnapshot(`
        {
          "enums": [
            {
              "enum_name": "account_status",
              "enum_schema": "main",
              "enum_values": [
                {
                  "enum_label": "active",
                },
                {
                  "enum_label": "disabled",
                },
              ],
            },
          ],
          "tables": [
            {
              "columns": [
                {
                  "column_default": null,
                  "column_name": "account_id",
                  "data_type": "INTEGER",
                  "is_nullable": "NO",
                  "is_updatable": "YES",
                  "numeric_precision_radix": 2,
                  "ordinal_position": 1,
                  "table_name": "account",
                  "table_schema": "main",
                },
                {
                  "column_default": null,
                  "column_name": "email",
                  "data_type": "VARCHAR",
                  "is_nullable": "NO",
                  "is_updatable": "YES",
                  "numeric_precision_radix": undefined,
                  "ordinal_position": 2,
                  "table_name": "account",
                  "table_schema": "main",
                },
                {
                  "column_default": null,
                  "column_name": "active",
                  "data_type": "BOOLEAN",
                  "is_nullable": "NO",
                  "is_updatable": "YES",
                  "numeric_precision_radix": undefined,
                  "ordinal_position": 3,
                  "table_name": "account",
                  "table_schema": "main",
                },
                {
                  "column_default": null,
                  "column_name": "created_at",
                  "data_type": "TIMESTAMP",
                  "is_nullable": "NO",
                  "is_updatable": "YES",
                  "numeric_precision_radix": undefined,
                  "ordinal_position": 4,
                  "table_name": "account",
                  "table_schema": "main",
                },
                {
                  "column_default": "'active'",
                  "column_name": "status",
                  "data_type": "ENUM('active', 'disabled')",
                  "is_nullable": "YES",
                  "is_updatable": "YES",
                  "numeric_precision_radix": undefined,
                  "ordinal_position": 5,
                  "table_name": "account",
                  "table_schema": "main",
                  "udt_name": "account_status",
                },
                {
                  "column_default": null,
                  "column_name": "parent_id",
                  "data_type": "INTEGER",
                  "is_nullable": "YES",
                  "is_updatable": "YES",
                  "numeric_precision_radix": 2,
                  "ordinal_position": 6,
                  "table_name": "account",
                  "table_schema": "main",
                },
              ],
              "foreign_keys": [
                {
                  "column_name": "parent_id",
                  "constraint_name": "account_parent_id_account_id_fkey",
                  "referenced_column_name": "account_id",
                  "referenced_table_name": "account",
                  "referenced_table_schema": "main",
                  "table_name": "account",
                  "table_schema": "main",
                },
              ],
              "primary_keys": [
                {
                  "column_name": "account_id",
                  "constraint_name": "account_account_id_pkey",
                  "ordinal_position": 1,
                  "table_name": "account",
                  "table_schema": "main",
                },
              ],
              "table_name": "account",
              "table_schema": "main",
              "table_type": "table",
            },
            {
              "columns": [
                {
                  "column_default": null,
                  "column_name": "account_id",
                  "data_type": "INTEGER",
                  "is_nullable": "YES",
                  "is_updatable": "NO",
                  "numeric_precision_radix": 2,
                  "ordinal_position": 1,
                  "table_name": "active_account",
                  "table_schema": "main",
                },
                {
                  "column_default": null,
                  "column_name": "email",
                  "data_type": "VARCHAR",
                  "is_nullable": "YES",
                  "is_updatable": "NO",
                  "numeric_precision_radix": undefined,
                  "ordinal_position": 2,
                  "table_name": "active_account",
                  "table_schema": "main",
                },
                {
                  "column_default": null,
                  "column_name": "active",
                  "data_type": "BOOLEAN",
                  "is_nullable": "YES",
                  "is_updatable": "NO",
                  "numeric_precision_radix": undefined,
                  "ordinal_position": 3,
                  "table_name": "active_account",
                  "table_schema": "main",
                },
                {
                  "column_default": null,
                  "column_name": "created_at",
                  "data_type": "TIMESTAMP",
                  "is_nullable": "YES",
                  "is_updatable": "NO",
                  "numeric_precision_radix": undefined,
                  "ordinal_position": 4,
                  "table_name": "active_account",
                  "table_schema": "main",
                },
                {
                  "column_default": null,
                  "column_name": "status",
                  "data_type": "ENUM('active', 'disabled')",
                  "is_nullable": "YES",
                  "is_updatable": "NO",
                  "numeric_precision_radix": undefined,
                  "ordinal_position": 5,
                  "table_name": "active_account",
                  "table_schema": "main",
                  "udt_name": "account_status",
                },
                {
                  "column_default": null,
                  "column_name": "parent_id",
                  "data_type": "INTEGER",
                  "is_nullable": "YES",
                  "is_updatable": "NO",
                  "numeric_precision_radix": 2,
                  "ordinal_position": 6,
                  "table_name": "active_account",
                  "table_schema": "main",
                },
              ],
              "primary_keys": [],
              "table_name": "active_account",
              "table_schema": "main",
              "table_type": "view",
            },
          ],
        }
      `);
   });

   test("preserves declared enum type names for code generation", async () => {
      await db.run(`
         create type order_status as enum ('created', 'paid', 'delivered');
         create table purchase_order (
            order_id integer primary key,
            status order_status not null default 'created'
         );
      `);
      const schema = await plugin.getSchema({ mode: "file", path, schemas: ["main"] });
      const account = schema.tables.find((table) => table.table_name === "account");
      const order = schema.tables.find((table) => table.table_name === "purchase_order");

      expect({
         account: account?.columns.find((column) => column.column_name === "status")?.udt_name,
         order: order?.columns.find((column) => column.column_name === "status")?.udt_name,
      }).toMatchInlineSnapshot(`
        {
          "account": "account_status",
          "order": "order_status",
        }
      `);
   });
});
