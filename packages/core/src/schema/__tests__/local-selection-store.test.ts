import { chmod, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
   LOCAL_SELECTION_FORMAT_VERSION,
   loadLocalSelection,
   resolveLocalSelectionPath,
   saveLocalSelection,
} from "#src/schema/local-selection-store.js";
import type { SchemaSelectionScope } from "#src/schema/schema-selection.js";

const scope: SchemaSelectionScope = {
   formatVersion: 1,
   catalogFormatVersion: 1,
   catalogFingerprint: "catalog-fingerprint",
   objects: [
      { id: "alpha.event_log", kind: "table", selected: false },
      { id: "alpha.record", kind: "table", selected: true },
      { id: "beta.event_view", kind: "view", selected: true },
   ],
};

async function temporaryDirectory(): Promise<string> {
   return mkdtemp(path.join(tmpdir(), "vexnor-selection-"));
}

describe("local selection store", () => {
   test("resolves vexnor.local.json beside the resolved config by default", () => {
      expect(resolveLocalSelectionPath("/workspace/config/vexnor.config.ts")).toMatchInlineSnapshot(`"/workspace/config/vexnor.local.json"`);
      expect(resolveLocalSelectionPath("/workspace/config/vexnor.config.ts", "./automation-selection.json")).toMatchInlineSnapshot(`"/workspace/config/automation-selection.json"`);
      expect(resolveLocalSelectionPath("/workspace/config/vexnor.config.ts", "/tmp/selection.json")).toMatchInlineSnapshot(`"/tmp/selection.json"`);
   });

   test("atomically creates and reads profile selection without credentials or row data", async () => {
      const directory = await temporaryDirectory();
      const filePath = path.join(directory, "vexnor.local.json");

      await saveLocalSelection({ filePath, profile: "dev", scope });

      expect(JSON.parse(await readFile(filePath, "utf8"))).toMatchInlineSnapshot(`
        {
          "formatVersion": 1,
          "profiles": {
            "dev": {
              "catalogFingerprint": "catalog-fingerprint",
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
          },
        }
      `);
      expect(await loadLocalSelection(filePath)).toMatchInlineSnapshot(`
        {
          "formatVersion": 1,
          "profiles": {
            "dev": {
              "catalogFingerprint": "catalog-fingerprint",
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
          },
        }
      `);
      expect(await readdir(directory)).toMatchInlineSnapshot(`
        [
          "vexnor.local.json",
        ]
      `);
   });

   test("preserves other profiles during an atomic update", async () => {
      const directory = await temporaryDirectory();
      const filePath = path.join(directory, "vexnor.local.json");

      await saveLocalSelection({ filePath, profile: "dev", scope });
      await saveLocalSelection({
         filePath,
         profile: "test",
         scope: { ...scope, catalogFingerprint: "test-fingerprint", objects: [{ id: "main.record", kind: "table", selected: true }] },
      });

      expect(await loadLocalSelection(filePath)).toMatchInlineSnapshot(`
        {
          "formatVersion": 1,
          "profiles": {
            "dev": {
              "catalogFingerprint": "catalog-fingerprint",
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
            "test": {
              "catalogFingerprint": "test-fingerprint",
              "catalogFormatVersion": 1,
              "formatVersion": 1,
              "objects": [
                {
                  "id": "main.record",
                  "kind": "table",
                  "selected": true,
                },
              ],
            },
          },
        }
      `);
   });

   test("returns an empty document when the local file is missing", async () => {
      const directory = await temporaryDirectory();
      expect(await loadLocalSelection(path.join(directory, "vexnor.local.json"))).toMatchInlineSnapshot(`
        {
          "formatVersion": 1,
          "profiles": {},
        }
      `);
   });

   test("rejects an unsupported version without overwriting the file", async () => {
      const directory = await temporaryDirectory();
      const filePath = path.join(directory, "vexnor.local.json");
      const original = JSON.stringify({ formatVersion: LOCAL_SELECTION_FORMAT_VERSION + 1, profiles: {} });
      await writeFile(filePath, original, "utf8");

      await expect(saveLocalSelection({ filePath, profile: "dev", scope })).rejects.toThrowErrorMatchingInlineSnapshot(`[LocalSelectionConfigError: Unsupported local selection format version: 2]`);
      expect(await readFile(filePath, "utf8")).toMatchInlineSnapshot(`"{"formatVersion":2,"profiles":{}}"`);
   });

   test("rejects malformed local state", async () => {
      const cases = [
         ["invalid JSON", "not-json"],
         ["unexpected top-level data", JSON.stringify({ formatVersion: 1, profiles: {}, credentials: "forbidden" })],
         ["invalid object identity", JSON.stringify({ formatVersion: 1, profiles: { dev: { ...scope, objects: [{ id: "record", kind: "table", selected: true }] } } })],
      ] as const;
      const errors: Record<string, { name: string; message: string }> = {};
      for (const [name, contents] of cases) {
         const directory = await temporaryDirectory();
         const filePath = path.join(directory, "vexnor.local.json");
         await writeFile(filePath, contents, "utf8");
         try {
            await loadLocalSelection(filePath);
         } catch (error) {
            if (!(error instanceof Error)) throw error;
            errors[name] = { name: error.name, message: error.message.replace(filePath, "<path>") };
         }
      }

      expect(errors).toMatchInlineSnapshot(`
        {
          "invalid JSON": {
            "message": "Malformed JSON in local selection config: <path>",
            "name": "LocalSelectionConfigError",
          },
          "invalid object identity": {
            "message": "Invalid schema-qualified object identity in profile 'dev' object 0",
            "name": "LocalSelectionConfigError",
          },
          "unexpected top-level data": {
            "message": "Unexpected fields in local selection config: credentials",
            "name": "LocalSelectionConfigError",
          },
        }
      `);
   });

   test("rejects every invalid persisted selection shape", async () => {
      const cases: Array<[string, unknown]> = [
         ["top-level array", []],
         ["profiles array", { formatVersion: 1, profiles: [] }],
         ["empty profile", { formatVersion: 1, profiles: { " ": scope } }],
         ["non-object scope", { formatVersion: 1, profiles: { dev: null } }],
         ["unexpected scope field", { formatVersion: 1, profiles: { dev: { ...scope, extra: true } } }],
         ["selection version", { formatVersion: 1, profiles: { dev: { ...scope, formatVersion: 2 } } }],
         ["catalog version", { formatVersion: 1, profiles: { dev: { ...scope, catalogFormatVersion: 0 } } }],
         ["catalog fingerprint", { formatVersion: 1, profiles: { dev: { ...scope, catalogFingerprint: "" } } }],
         ["objects object", { formatVersion: 1, profiles: { dev: { ...scope, objects: {} } } }],
         ["non-object selection", { formatVersion: 1, profiles: { dev: { ...scope, objects: [null] } } }],
         ["unexpected selection field", { formatVersion: 1, profiles: { dev: { ...scope, objects: [{ ...scope.objects[0], extra: true }] } } }],
         ["object kind", { formatVersion: 1, profiles: { dev: { ...scope, objects: [{ ...scope.objects[0], kind: "materialized-view" }] } } }],
         ["selected state", { formatVersion: 1, profiles: { dev: { ...scope, objects: [{ ...scope.objects[0], selected: "yes" }] } } }],
         ["duplicate object", { formatVersion: 1, profiles: { dev: { ...scope, objects: [scope.objects[0], scope.objects[0]] } } }],
      ];
      const errors: Record<string, { name: string; message: string }> = {};

      for (const [name, value] of cases) {
         const directory = await temporaryDirectory();
         const filePath = path.join(directory, "vexnor.local.json");
         await writeFile(filePath, JSON.stringify(value), "utf8");
         try {
            await loadLocalSelection(filePath);
         } catch (error) {
            if (!(error instanceof Error)) throw error;
            errors[name] = { name: error.name, message: error.message.replace(filePath, "<path>") };
         }
      }

      expect(errors).toMatchInlineSnapshot(`
        {
          "catalog fingerprint": {
            "message": "Invalid catalog fingerprint in profile 'dev'",
            "name": "LocalSelectionConfigError",
          },
          "catalog version": {
            "message": "Invalid catalog format version in profile 'dev'",
            "name": "LocalSelectionConfigError",
          },
          "duplicate object": {
            "message": "Duplicate schema object identity in profile 'dev': alpha.event_log",
            "name": "LocalSelectionConfigError",
          },
          "empty profile": {
            "message": "Local selection profile name cannot be empty",
            "name": "LocalSelectionConfigError",
          },
          "non-object scope": {
            "message": "Local selection profile 'dev' must be an object",
            "name": "LocalSelectionConfigError",
          },
          "non-object selection": {
            "message": "profile 'dev' object 0 must be an object",
            "name": "LocalSelectionConfigError",
          },
          "object kind": {
            "message": "Invalid object kind in profile 'dev' object 0: materialized-view",
            "name": "LocalSelectionConfigError",
          },
          "objects object": {
            "message": "Local selection objects in profile 'dev' must be an array",
            "name": "LocalSelectionConfigError",
          },
          "profiles array": {
            "message": "Local selection profiles must be an object",
            "name": "LocalSelectionConfigError",
          },
          "selected state": {
            "message": "Invalid selected state in profile 'dev' object 0",
            "name": "LocalSelectionConfigError",
          },
          "selection version": {
            "message": "Unsupported schema selection format version in profile 'dev': 2",
            "name": "LocalSelectionConfigError",
          },
          "top-level array": {
            "message": "Local selection config must be an object: <path>",
            "name": "LocalSelectionConfigError",
          },
          "unexpected scope field": {
            "message": "Unexpected fields in profile 'dev': extra",
            "name": "LocalSelectionConfigError",
          },
          "unexpected selection field": {
            "message": "Unexpected fields in profile 'dev' object 0: extra",
            "name": "LocalSelectionConfigError",
          },
        }
      `);
   });

   test("wraps non-missing read failures and rejects empty profile names", async () => {
      const directory = await temporaryDirectory();
      let readError: { name: string; message: string } | undefined;
      try {
         await loadLocalSelection(directory);
      } catch (error) {
         if (!(error instanceof Error)) throw error;
         readError = { name: error.name, message: error.message.replace(directory, "<path>") };
      }
      expect(readError).toMatchInlineSnapshot(`
        {
          "message": "Failed to read local selection config: <path>",
          "name": "LocalSelectionConfigError",
        }
      `);
      await expect(saveLocalSelection({
         filePath: path.join(directory, "vexnor.local.json"),
         profile: " ",
         scope,
      })).rejects.toThrowErrorMatchingInlineSnapshot(`[LocalSelectionConfigError: Local selection profile name cannot be empty]`);
   });

   test("cleans up and preserves the existing document when an atomic write fails", async () => {
      const directory = await temporaryDirectory();
      const filePath = path.join(directory, "vexnor.local.json");
      await saveLocalSelection({ filePath, profile: "dev", scope });
      const original = await readFile(filePath, "utf8");
      let writeError: { name: string; message: string } | undefined;

      await chmod(directory, 0o500);
      try {
         await saveLocalSelection({
            filePath,
            profile: "test",
            scope: { ...scope, catalogFingerprint: "test-fingerprint" },
         });
      } catch (error) {
         if (!(error instanceof Error)) throw error;
         writeError = { name: error.name, message: error.message.replace(filePath, "<path>") };
      } finally {
         await chmod(directory, 0o700);
      }

      expect({
         writeError,
         unchanged: (await readFile(filePath, "utf8")) === original,
         files: await readdir(directory),
      }).toMatchInlineSnapshot(`
        {
          "files": [
            "vexnor.local.json",
          ],
          "unchanged": true,
          "writeError": {
            "message": "Failed to atomically write local selection config: <path>",
            "name": "LocalSelectionConfigError",
          },
        }
      `);
   });
});
