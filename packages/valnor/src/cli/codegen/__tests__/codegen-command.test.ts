import { describe, expect, test, vi } from "vitest";
import { codegenCommand } from "#/cli/codegen/codegen-command.js";
import { join } from "node:path";
import os from "node:os";

vi.mock("../../../load-plugin.js");

const baseOptions = {
   plugin: "valnor-sqlite3",
   schema: ["main"],
   pascalCaseTables: true,
   camelCaseColumns: true,
};

describe("codegenCommand outDir validation", () => {
   test("throws when outDir does not exist", async () => {
      await expect(
         codegenCommand({ ...baseOptions, outDir: "/nonexistent/path/that/does/not/exist" }),
      ).rejects.toMatchInlineSnapshot(`[Error: ENOENT: no such file or directory, stat '/nonexistent/path/that/does/not/exist']`);
   });

   test("throws when outDir is a file not a directory", async () => {
      const file = join(os.tmpdir(), "valnor-test-file.txt");
      await import("node:fs/promises").then((fs) => fs.writeFile(file, ""));

      const err = await codegenCommand({ ...baseOptions, outDir: file }).catch((e: Error) => e.message);
      expect(err).toMatchInlineSnapshot(`"${file} is not a valid output directory"`);
   });
});
