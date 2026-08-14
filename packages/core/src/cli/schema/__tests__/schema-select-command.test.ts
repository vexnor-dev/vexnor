import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { VexnorPlugin, VexnorConnection, type SqlColumnInfo, type SqlColumnType, type SqlSchema } from "#src/plugin/plugin.js";
import type { SqlQuery } from "#src/core/query/sql-query.js";
import { MockQueryHandler } from "#src/test/mock-query-handler.js";
import { schemaSelectCommand } from "#src/cli/schema/schema-select-command.js";

class SchemaPlugin extends VexnorPlugin<{ Config: { uri: string }; Connection: object }> {
   readonly name = "@vexnor/schema-test";
   readonly version = "1.0.0";
   readonly driver = "schema-test";
   readonly dialect = "schema-test";
   readonly schemaCalls: Array<{ uri: string; schemas: string[] }> = [];

   getColumnType(_column: SqlColumnInfo): SqlColumnType {
      return { type: "string" };
   }

   async getSchema(args: { uri: string; schemas: string[] }): Promise<SqlSchema> {
      this.schemaCalls.push(args);
      return {
         enums: [],
         tables: ["record", "event_log"].map((table_name) => ({
            table_schema: "alpha",
            table_name,
            table_type: "table",
            columns: [{
               table_schema: "alpha",
               table_name,
               column_name: "record_id",
               column_default: null,
               is_nullable: "NO",
               is_updatable: "YES",
               udt_name: "text",
            }],
            primary_keys: [],
            foreign_keys: [],
         })),
      };
   }

   getLibrary() {
      return [];
   }

   async createConnection<TContext extends Record<string, unknown>>(_args: {
      config: { uri: string };
   }): Promise<VexnorConnection<{ Connection: object; Context: TContext }>> {
      return new VexnorConnection<{ Connection: object; Context: TContext }>({}, () => {}, null);
   }

   newQueryHandler<Args extends { Row?: unknown; Params?: unknown; Read: object; Write: object }>(
      query: SqlQuery<Pick<Args, "Row" | "Params">>,
   ) {
      return new MockQueryHandler<Pick<Args, "Row" | "Params">>(query);
   }
}

function config() {
   return {
      defaultProfile: "dev",
      profiles: {
         dev: {
            plugin: "@vexnor/schema-test",
            connection: { uri: "schema-test://local" },
            generate: { schema: ["alpha"], outDir: "./generated", camelCaseColumns: true },
         },
      },
   };
}

describe("schemaSelectCommand", () => {
   test("resolves the profile, introspects, and keeps non-interactive selection invocation-scoped", async () => {
      const directory = await mkdtemp(path.join(tmpdir(), "vexnor-schema-command-"));
      const plugin = new SchemaPlugin();
      const output: string[] = [];
      const result = await schemaSelectCommand(
         {
            config: path.join(directory, "vexnor.config.ts"),
            selectionConfig: path.join(directory, "selection.json"),
            include: ["alpha.record"],
         },
         {
            loadConfig: async () => config(),
            loadPlugin: async () => ({ plugin, path: "@vexnor/schema-test" }),
            review: vi.fn(),
            write: (message) => output.push(message),
         },
      );

      expect({
         result: { ...result, selectionConfigPath: result.selectionConfigPath.replace(directory, "<dir>") },
         schemaCalls: plugin.schemaCalls,
         output: output.map((message) => message.replace(directory, "<dir>")),
      }).toMatchInlineSnapshot(`
        {
          "output": [
            "Inspecting 1 schema for profile 'dev'...",
            "Discovered 2 schema objects:",
            "  [table] alpha.event_log (1 column)",
            "  [table] alpha.record (1 column)",
            "Selected 1 of 2 schema objects for profile 'dev'.",
            "Selection config: <dir>/selection.json",
          ],
          "result": {
            "deselectedObjects": [
              {
                "id": "alpha.event_log",
                "kind": "table",
                "selected": false,
              },
            ],
            "newObjects": [],
            "removedObjects": [],
            "scope": {
              "catalogFingerprint": "ae5d9ff166a832c9d06642a7f079ebc94c86309bb4c084423685cc24c39a8c06",
              "catalogFormatVersion": 1,
              "formatVersion": 1,
              "objects": [
                {
                  "id": "alpha.event_log",
                  "kind": "table",
                  "selected": false,
                },
                {
                  "id": "alpha.record",
                  "kind": "table",
                  "selected": true,
                },
              ],
            },
            "selectedObjects": [
              {
                "id": "alpha.record",
                "kind": "table",
                "selected": true,
              },
            ],
            "selectionConfigPath": "<dir>/selection.json",
          },
          "schemaCalls": [
            {
              "schemas": [
                "alpha",
              ],
              "uri": "schema-test://local",
            },
          ],
        }
      `);
      await expect(access(path.join(directory, "selection.json")).then(() => true, () => false)).resolves.toBe(false);
   });

   test("uses grouped interactive review and persists the confirmed selection", async () => {
      const directory = await mkdtemp(path.join(tmpdir(), "vexnor-schema-command-"));
      const plugin = new SchemaPlugin();
      const review = vi.fn(async () => ({ selected: ["alpha.event_log"], confirmRemoved: true }));
      await schemaSelectCommand(
         { config: path.join(directory, "vexnor.config.ts") },
         {
            loadConfig: async () => config(),
            loadPlugin: async () => ({ plugin, path: "@vexnor/schema-test" }),
            review,
            write: () => {},
         },
      );

      expect(review.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "firstRun": true,
              "objects": [
                {
                  "id": "alpha.event_log",
                  "kind": "table",
                  "name": "event_log",
                  "schema": "alpha",
                  "selected": true,
                  "status": "existing",
                },
                {
                  "id": "alpha.record",
                  "kind": "table",
                  "name": "record",
                  "schema": "alpha",
                  "selected": true,
                  "status": "existing",
                },
              ],
              "removedObjects": [],
              "schemas": [
                "alpha",
              ],
            },
          ],
        ]
      `);
      expect(JSON.parse(await readFile(path.join(directory, "vexnor.local.json"), "utf8"))).toMatchInlineSnapshot(`
        {
          "formatVersion": 1,
          "profiles": {
            "dev": {
              "catalogFingerprint": "ae5d9ff166a832c9d06642a7f079ebc94c86309bb4c084423685cc24c39a8c06",
              "catalogFormatVersion": 1,
              "formatVersion": 1,
              "objects": [
                {
                  "id": "alpha.event_log",
                  "kind": "table",
                  "selected": true,
                },
                {
                  "id": "alpha.record",
                  "kind": "table",
                  "selected": false,
                },
              ],
            },
          },
        }
      `);
   });

   test("fails when the resolved profile is invalid", async () => {
      const dependencies = {
         loadConfig: async () => config(),
         loadPlugin: async () => ({ plugin: new SchemaPlugin(), path: "@vexnor/schema-test" }),
         review: vi.fn(),
         write: () => {},
      };

      await expect(schemaSelectCommand({ profile: "missing" }, dependencies)).rejects.toThrowErrorMatchingInlineSnapshot(`[SchemaConfigurationError: Unknown Vexnor profile: missing]`);
   });
});
