import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { codegenCommand } from "#src/cli/codegen/codegen-command.js";
import { loadPlugin } from "#src/load-plugin.js";
import { MockPlugin } from "#src/test/mock-plugin.js";
import type { SqlColumnInfo, SqlColumnType, SqlSchema } from "#src/plugin/plugin.js";
import { saveLocalSelection } from "#src/schema/local-selection-store.js";

vi.mock("#src/load-plugin.js", () => ({ loadPlugin: vi.fn() }));

class SelectedCodegenPlugin extends MockPlugin {
   override readonly version = "1.0.0";

   constructor() {
      super({ name: "@vexnor/selected-codegen" });
   }

   override getColumnType(_column: SqlColumnInfo): SqlColumnType {
      return { type: "string" };
   }

   override getSchema(): Promise<SqlSchema> {
      return Promise.resolve({
         enums: [],
         tables: [
            { table_schema: "alpha", table_name: "event_log", table_type: "table", columns: [column("event_log")], primary_keys: [], foreign_keys: [] },
            { table_schema: "alpha", table_name: "event_view", table_type: "view", columns: [column("event_view")], primary_keys: [], foreign_keys: [] },
            { table_schema: "alpha", table_name: "record", table_type: "table", columns: [column("record")], primary_keys: [], foreign_keys: [] },
         ],
      });
   }
}

function column(table_name: string): SqlColumnInfo {
   return {
      table_schema: "alpha",
      table_name,
      column_name: "record_id",
      column_default: null,
      is_nullable: "NO",
      is_updatable: "YES",
      udt_name: "text",
   };
}

describe("selected codegen", () => {
   beforeEach(() => {
      vi.mocked(loadPlugin).mockResolvedValue({ plugin: new SelectedCodegenPlugin(), path: "@vexnor/selected-codegen" });
   });

   test("automatically reuses the saved profile allowlist", async () => {
      const directory = await mkdtemp(path.join(tmpdir(), "vexnor-selected-codegen-"));
      const outDir = path.join(directory, "generated");
      const configPath = path.join(directory, "vexnor.config.mjs");
      await mkdir(outDir);
      await writeFile(configPath, `export default { defaultProfile: "dev", profiles: { dev: { connection: { uri: "test://local" }, generate: { schema: ["alpha"], outDir: "./generated" } } } };`, "utf8");
      await saveLocalSelection({
         filePath: path.join(directory, "vexnor.local.json"),
         profile: "dev",
         scope: {
            formatVersion: 1,
            catalogFormatVersion: 1,
            catalogFingerprint: "previous-fingerprint",
            objects: [
               { id: "alpha.event_log", kind: "table", selected: false },
               { id: "alpha.event_view", kind: "view", selected: true },
               { id: "alpha.record", kind: "table", selected: true },
            ],
         },
      });

      await codegenCommand({
         plugin: "@vexnor/selected-codegen",
         schema: ["alpha"],
         uri: "test://local",
         outDir,
         config: configPath,
      });

      expect((await readdir(outDir)).sort()).toMatchInlineSnapshot(`
        [
          "alpha.event_view-view.ts",
          "alpha.record-table.ts",
          "alpha.schema.ts",
          "index.ts",
        ]
      `);
      expect(await readFile(path.join(outDir, "alpha.schema.ts"), "utf8")).toMatchInlineSnapshot(`
        "export * from "./alpha.event_view-view.js";
        export * from "./alpha.record-table.js";

        "
      `);
   });
});
