import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { SqlColumnInfo, SqlSchema } from "#src/plugin/plugin.js";
import { createSchemaCatalog, type SchemaCatalogPluginSource } from "#src/schema/schema-catalog.js";
import { reconcileSchemaSelection, resolveSchemaSelection, selectSchemaObjects } from "#src/schema/schema-selection.js";

const plugin: SchemaCatalogPluginSource = {
   name: "@vexnor/synthetic",
   version: "1.2.3",
   driver: "synthetic",
   dialect: "synthetic",
   getColumnType: () => ({ type: "string" }),
};

function column(table_schema: string, table_name: string, column_name: string): SqlColumnInfo {
   return {
      table_schema,
      table_name,
      column_name,
      column_default: null,
      is_nullable: "NO",
      is_updatable: "YES",
      udt_name: "text",
   };
}

function catalog(ids: string[]) {
   const schema: SqlSchema = {
      enums: [],
      tables: ids.map((id) => {
         const [table_schema, table_name] = id.split(".");
         if (!table_schema || !table_name) throw new Error(`Invalid test identity: ${id}`);
         return {
            table_schema,
            table_name,
            table_type: table_name.endsWith("_view") ? "view" : "table",
            columns: [column(table_schema, table_name, "record_id")],
            primary_keys: [],
            foreign_keys: [],
         };
      }),
   };
   return createSchemaCatalog({ plugin, schema });
}

describe("resolveSchemaSelection", () => {
   test("first interactive review starts with every discovered object selected and groups by schema", async () => {
      const result = await resolveSchemaSelection({
         catalog: catalog(["beta.event_view", "alpha.record", "alpha.event_log"]),
         request: {
            mode: "interactive",
            review: async (review) => {
               expect(review).toMatchInlineSnapshot(`
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
                     {
                       "id": "beta.event_view",
                       "kind": "view",
                       "name": "event_view",
                       "schema": "beta",
                       "selected": true,
                       "status": "existing",
                     },
                   ],
                   "removedObjects": [],
                   "schemas": [
                     "alpha",
                     "beta",
                   ],
                 }
               `);
               return { selected: review.objects.filter((object) => object.selected).map((object) => object.id), confirmRemoved: true };
            },
         },
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "deselectedObjects": [],
          "newObjects": [],
          "removedObjects": [],
          "scope": {
            "catalogFingerprint": "833e83bb89d84d48b66999cca1b0ac732987f18fd7c095e967b6ee6afee151dd",
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
                "selected": true,
              },
              {
                "id": "beta.event_view",
                "kind": "view",
                "selected": true,
              },
            ],
          },
          "selectedObjects": [
            {
              "id": "alpha.event_log",
              "kind": "table",
              "selected": true,
            },
            {
              "id": "alpha.record",
              "kind": "table",
              "selected": true,
            },
            {
              "id": "beta.event_view",
              "kind": "view",
              "selected": true,
            },
          ],
        }
      `);
   });

   test("restores prior selections and deselections while marking new objects unselected", async () => {
      const initial = await resolveSchemaSelection({
         catalog: catalog(["alpha.record", "alpha.event_log", "beta.event_view"]),
         request: { mode: "non-interactive", include: ["alpha.record"] },
      });

      const result = await resolveSchemaSelection({
         catalog: catalog(["alpha.record", "alpha.audit_log", "beta.event_view"]),
         previousSelection: initial.scope,
         request: {
            mode: "interactive",
            review: async (review) => {
               expect(review).toMatchInlineSnapshot(`
                 {
                   "firstRun": false,
                   "objects": [
                     {
                       "id": "alpha.audit_log",
                       "kind": "table",
                       "name": "audit_log",
                       "schema": "alpha",
                       "selected": false,
                       "status": "new",
                     },
                     {
                       "id": "alpha.record",
                       "kind": "table",
                       "name": "record",
                       "schema": "alpha",
                       "selected": true,
                       "status": "existing",
                     },
                     {
                       "id": "beta.event_view",
                       "kind": "view",
                       "name": "event_view",
                       "schema": "beta",
                       "selected": false,
                       "status": "existing",
                     },
                   ],
                   "removedObjects": [
                     {
                       "id": "alpha.event_log",
                       "kind": "table",
                       "selected": false,
                     },
                   ],
                   "schemas": [
                     "alpha",
                     "beta",
                   ],
                 }
               `);
               return { selected: ["alpha.record"], confirmRemoved: true };
            },
         },
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "deselectedObjects": [
            {
              "id": "alpha.audit_log",
              "kind": "table",
              "selected": false,
            },
            {
              "id": "beta.event_view",
              "kind": "view",
              "selected": false,
            },
          ],
          "newObjects": [
            {
              "id": "alpha.audit_log",
              "kind": "table",
              "selected": false,
            },
          ],
          "removedObjects": [
            {
              "id": "alpha.event_log",
              "kind": "table",
              "selected": false,
            },
          ],
          "scope": {
            "catalogFingerprint": "a2f93391ea040657210f1bcd19bdd233ad4e46ec9a7245301266f50a1e349fe2",
            "catalogFormatVersion": 1,
            "formatVersion": 1,
            "objects": [
              {
                "id": "alpha.audit_log",
                "kind": "table",
                "selected": false,
              },
              {
                "id": "alpha.record",
                "kind": "table",
                "selected": true,
              },
              {
                "id": "beta.event_view",
                "kind": "view",
                "selected": false,
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
        }
      `);
   });

   test("does not prune removed objects without explicit confirmation", async () => {
      const initial = await resolveSchemaSelection({
         catalog: catalog(["alpha.record", "alpha.event_log"]),
         request: { mode: "non-interactive", all: true },
      });

      await expect(
         resolveSchemaSelection({
            catalog: catalog(["alpha.record"]),
            previousSelection: initial.scope,
            request: {
               mode: "interactive",
               review: async () => ({ selected: ["alpha.record"], confirmRemoved: false }),
            },
         }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`[SchemaSelectionError: Removed schema objects require explicit confirmation before pruning]`);
   });

   test("fails closed for invalid non-interactive requests", async () => {
      const cases = [
         ["unknown include", { mode: "non-interactive", include: ["alpha.missing"] }],
         ["ambiguous unqualified include", { mode: "non-interactive", include: ["record"] }],
         ["duplicate include", { mode: "non-interactive", include: ["alpha.record", "alpha.record"] }],
         ["conflicting include and exclude", { mode: "non-interactive", include: ["alpha.record"], exclude: ["alpha.record"] }],
         ["conflicting all and include", { mode: "non-interactive", all: true, include: ["alpha.record"] }],
         ["empty resolved scope", { mode: "non-interactive", all: true, exclude: ["alpha.record", "beta.record"] }],
         ["missing scope request", { mode: "non-interactive" }],
      ] as const;
      const errors: Record<string, { name: string; message: string }> = {};
      for (const [name, request] of cases) {
         try {
            await resolveSchemaSelection({ catalog: catalog(["alpha.record", "beta.record"]), request });
         } catch (error) {
            if (!(error instanceof Error)) throw error;
            errors[name] = { name: error.name, message: error.message };
         }
      }

      expect(errors).toMatchInlineSnapshot(`
        {
          "ambiguous unqualified include": {
            "message": "Ambiguous schema object identity 'record': alpha.record, beta.record",
            "name": "SchemaSelectionError",
          },
          "conflicting all and include": {
            "message": "--all conflicts with --include",
            "name": "SchemaSelectionError",
          },
          "conflicting include and exclude": {
            "message": "Conflicting included and excluded schema objects: alpha.record",
            "name": "SchemaSelectionError",
          },
          "duplicate include": {
            "message": "Duplicate include entries: alpha.record",
            "name": "SchemaSelectionError",
          },
          "empty resolved scope": {
            "message": "Schema selection resolved to an empty allowlist",
            "name": "SchemaSelectionError",
          },
          "missing scope request": {
            "message": "Non-interactive selection requires --all, --include, or --exclude",
            "name": "SchemaSelectionError",
          },
          "unknown include": {
            "message": "Unknown schema object identity: alpha.missing",
            "name": "SchemaSelectionError",
          },
        }
      `);
   });

   test("supports an all-except scope and unique unqualified identities", async () => {
      const result = await resolveSchemaSelection({
         catalog: catalog(["alpha.record", "alpha.event_log", "beta.event_view"]),
         request: { mode: "non-interactive", all: true, exclude: ["event_log"] },
      });

      expect(result).toMatchInlineSnapshot(`
        {
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
            "catalogFingerprint": "833e83bb89d84d48b66999cca1b0ac732987f18fd7c095e967b6ee6afee151dd",
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
              {
                "id": "beta.event_view",
                "kind": "view",
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
            {
              "id": "beta.event_view",
              "kind": "view",
              "selected": true,
            },
          ],
        }
      `);
   });

   test("reuses stored selection with new objects unselected and removed objects reported", async () => {
      const initial = await resolveSchemaSelection({
         catalog: catalog(["alpha.record", "alpha.event_log", "alpha.old_record"]),
         request: { mode: "non-interactive", include: ["alpha.record", "alpha.old_record"] },
      });

      expect(reconcileSchemaSelection({
         catalog: catalog(["alpha.record", "alpha.event_log", "alpha.audit_log"]),
         selection: initial.scope,
      })).toMatchInlineSnapshot(`
        {
          "deselectedObjects": [
            {
              "id": "alpha.audit_log",
              "kind": "table",
              "selected": false,
            },
            {
              "id": "alpha.event_log",
              "kind": "table",
              "selected": false,
            },
          ],
          "newObjects": [
            {
              "id": "alpha.audit_log",
              "kind": "table",
              "selected": false,
            },
          ],
          "removedObjects": [
            {
              "id": "alpha.old_record",
              "kind": "table",
              "selected": true,
            },
          ],
          "scope": {
            "catalogFingerprint": "84dff351721bedca9151e181b396dd72918bb3577a10f52802642c7626e9f2e8",
            "catalogFormatVersion": 1,
            "formatVersion": 1,
            "objects": [
              {
                "id": "alpha.audit_log",
                "kind": "table",
                "selected": false,
              },
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
        }
      `);
   });

   test("persists interactive selection while keeping non-interactive overrides invocation-scoped by default", async () => {
      const directory = await mkdtemp(path.join(tmpdir(), "vexnor-selection-api-"));
      const configPath = path.join(directory, "vexnor.config.ts");
      const first = await selectSchemaObjects({
         catalog: catalog(["alpha.record", "alpha.event_log"]),
         profile: "dev",
         configPath,
         request: {
            mode: "interactive",
            review: async () => ({ selected: ["alpha.record"], confirmRemoved: true }),
         },
      });
      const override = await selectSchemaObjects({
         catalog: catalog(["alpha.record", "alpha.event_log"]),
         profile: "dev",
         configPath,
         request: { mode: "non-interactive", all: true },
      });

      expect({
         first: { ...first, selectionConfigPath: first.selectionConfigPath.replace(directory, "<dir>") },
         override: { ...override, selectionConfigPath: override.selectionConfigPath.replace(directory, "<dir>") },
         persisted: JSON.parse(await readFile(path.join(directory, "vexnor.local.json"), "utf8")),
      }).toMatchInlineSnapshot(`
        {
          "first": {
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
              "catalogFingerprint": "fd42e6156d1688c14588acddbe35663c4755f94fb90df987cf896c78b36fd4d3",
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
            "selectionConfigPath": "<dir>/vexnor.local.json",
          },
          "override": {
            "deselectedObjects": [],
            "newObjects": [],
            "removedObjects": [],
            "scope": {
              "catalogFingerprint": "fd42e6156d1688c14588acddbe35663c4755f94fb90df987cf896c78b36fd4d3",
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
                  "selected": true,
                },
              ],
            },
            "selectedObjects": [
              {
                "id": "alpha.event_log",
                "kind": "table",
                "selected": true,
              },
              {
                "id": "alpha.record",
                "kind": "table",
                "selected": true,
              },
            ],
            "selectionConfigPath": "<dir>/vexnor.local.json",
          },
          "persisted": {
            "formatVersion": 1,
            "profiles": {
              "dev": {
                "catalogFingerprint": "fd42e6156d1688c14588acddbe35663c4755f94fb90df987cf896c78b36fd4d3",
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
            },
          },
        }
      `);
   });

   test("rejects invalid stored scopes, resolved duplicates, empty identities, and blank profiles", async () => {
      const currentCatalog = catalog(["alpha.record", "alpha.event_log"]);
      const initial = await resolveSchemaSelection({
         catalog: currentCatalog,
         request: { mode: "non-interactive", all: true },
      });
      const wrongSelectionVersion = structuredClone(initial.scope);
      Reflect.set(wrongSelectionVersion, "formatVersion", 2);
      const wrongCatalogVersion = structuredClone(initial.scope);
      Reflect.set(wrongCatalogVersion, "catalogFormatVersion", 2);
      const duplicatePreviousObjects = structuredClone(initial.scope);
      duplicatePreviousObjects.objects.push(duplicatePreviousObjects.objects[0]!);
      const deselected = structuredClone(initial.scope);
      for (const object of deselected.objects) object.selected = false;

      const cases: Array<[string, () => Promise<unknown>]> = [
         ["duplicate resolved identity", () => resolveSchemaSelection({
            catalog: currentCatalog,
            request: { mode: "non-interactive", include: ["alpha.record", "record"] },
         })],
         ["empty identity", () => resolveSchemaSelection({
            catalog: currentCatalog,
            request: { mode: "non-interactive", include: [" "] },
         })],
         ["stored empty allowlist", async () => reconcileSchemaSelection({ catalog: currentCatalog, selection: deselected })],
         ["selection version", () => resolveSchemaSelection({
            catalog: currentCatalog,
            previousSelection: wrongSelectionVersion,
            request: { mode: "non-interactive", all: true },
         })],
         ["catalog version", () => resolveSchemaSelection({
            catalog: currentCatalog,
            previousSelection: wrongCatalogVersion,
            request: { mode: "non-interactive", all: true },
         })],
         ["duplicate stored identity", () => resolveSchemaSelection({
            catalog: currentCatalog,
            previousSelection: duplicatePreviousObjects,
            request: { mode: "non-interactive", all: true },
         })],
         ["blank profile", () => selectSchemaObjects({
            catalog: currentCatalog,
            profile: " ",
            configPath: "/tmp/vexnor.config.ts",
            request: { mode: "non-interactive", all: true },
         })],
      ];
      const errors: Record<string, { name: string; message: string }> = {};
      for (const [name, run] of cases) {
         try {
            await run();
         } catch (error) {
            if (!(error instanceof Error)) throw error;
            errors[name] = { name: error.name, message: error.message };
         }
      }

      expect(errors).toMatchInlineSnapshot(`
        {
          "blank profile": {
            "message": "A resolved Vexnor profile is required for schema selection",
            "name": "SchemaSelectionError",
          },
          "catalog version": {
            "message": "Schema selection catalog version 2 does not match catalog version 1",
            "name": "SchemaSelectionError",
          },
          "duplicate resolved identity": {
            "message": "Duplicate include identities: alpha.record",
            "name": "SchemaSelectionError",
          },
          "duplicate stored identity": {
            "message": "Duplicate previous schema selection identities: alpha.event_log",
            "name": "SchemaSelectionError",
          },
          "empty identity": {
            "message": "Schema object identities cannot be empty",
            "name": "SchemaSelectionError",
          },
          "selection version": {
            "message": "Unsupported schema selection format version: 2",
            "name": "SchemaSelectionError",
          },
          "stored empty allowlist": {
            "message": "Stored schema selection resolved to an empty allowlist",
            "name": "SchemaSelectionError",
          },
        }
      `);
   });
});
