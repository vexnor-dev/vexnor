import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
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
});
