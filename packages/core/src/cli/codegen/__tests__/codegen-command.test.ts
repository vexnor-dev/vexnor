import { describe, expect, test, vi } from "vitest";
import { codegenCommand, resolveGenerateConfig } from "#src/cli/codegen/codegen-command.js";
import { join, resolve } from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

vi.mock("#src/load-plugin.js");

const FIXTURE_CONFIG = resolve(import.meta.dirname, "./fixtures/codegen.config.ts");

const baseOptions = {
   plugin: "@vexnor/sqlite3",
   schema: ["main"],
   camelCaseColumns: true,
};

describe("codegenCommand outDir validation", () => {
   test("throws when outDir does not exist", async () => {
      await expect(
         codegenCommand({ ...baseOptions, outDir: "/nonexistent/path/that/does/not/exist" }),
      ).rejects.toMatchInlineSnapshot(`[Error: ENOENT: no such file or directory, stat '/nonexistent/path/that/does/not/exist']`);
   });

   test("throws when outDir is a file not a directory", async () => {
      const file = join(os.tmpdir(), "vexnor-test-file.txt");
      await fs.writeFile(file, "");

      const err = await codegenCommand({ ...baseOptions, outDir: file }).catch((e: Error) => e.message);
      expect(err).toMatchInlineSnapshot(`"${file} is not a valid output directory"`);
   });
});

describe("resolveGenerateConfig", () => {
   test("returns null when config file does not exist", async () => {
      const result = await resolveGenerateConfig({
         ...baseOptions,
         outDir: ".",
         config: "/nonexistent/vexnor.config.ts",
      });
      expect(result).toMatchInlineSnapshot(`null`);
   });

   test("returns null when profile does not exist in config", async () => {
      const result = await resolveGenerateConfig({
         ...baseOptions,
         outDir: ".",
         config: FIXTURE_CONFIG,
         profile: "nonexistent",
      });
      expect(result).toMatchInlineSnapshot(`null`);
   });

   test("returns null when no profile specified and no defaultProfile in config", async () => {
      const result = await resolveGenerateConfig({
         ...baseOptions,
         outDir: ".",
         config: resolve(import.meta.dirname, "../../../../config/__tests__/fixtures/vexnor.config.ts"),
      });
      expect(result).toMatchInlineSnapshot(`null`);
   });

   test("resolves generate from defaultProfile when no profile specified", async () => {
      const result = await resolveGenerateConfig({
         ...baseOptions,
         outDir: ".",
         config: FIXTURE_CONFIG,
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "outDir": "./out",
          "plugin": "test-plugin",
          "schema": [
            "public",
          ],
          "schemas": {
            "public": {
              "tables": {
                "account": {
                  "columns": {
                    "metadata": {
                      "json": {
                        "city": "string",
                        "score": "number",
                      },
                    },
                  },
                },
              },
            },
          },
        }
      `);
   });

   test("resolves generate from explicit profile", async () => {
      const result = await resolveGenerateConfig({
         ...baseOptions,
         outDir: ".",
         config: FIXTURE_CONFIG,
         profile: "analytics",
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "outDir": "./out/analytics",
          "plugin": "test-plugin",
          "schema": [
            "analytics",
          ],
        }
      `);
   });

   test("resolves generate.schemas for the active profile", async () => {
      const result = await resolveGenerateConfig({
         ...baseOptions,
         outDir: ".",
         config: FIXTURE_CONFIG,
         profile: "postgres",
      });
      expect(result?.schemas).toMatchInlineSnapshot(`
        {
          "public": {
            "tables": {
              "account": {
                "columns": {
                  "metadata": {
                    "json": {
                      "city": "string",
                      "score": "number",
                    },
                  },
                },
              },
            },
          },
        }
      `);
   });
});
