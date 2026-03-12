import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { initCommand } from "#/cli/exec/init-command.js";

const TEST_DIR = path.join(process.cwd(), "test-init-output");

describe("initCommand", () => {
   beforeEach(async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      process.chdir(TEST_DIR);
   });

   afterEach(async () => {
      process.chdir(path.join(TEST_DIR, ".."));
      await fs.rm(TEST_DIR, { recursive: true, force: true });
   });

   it("should create valnor.config.ts and queries.valnor.ts", async () => {
      await initCommand({});

      const configExists = await fs
         .access("valnor.config.ts")
         .then(() => true)
         .catch(() => false);
      const queryConfigExists = await fs
         .access("queries.valnor.ts")
         .then(() => true)
         .catch(() => false);

      expect(configExists).toBe(true);
      expect(queryConfigExists).toBe(true);
   });

   it("should create valid config file content", async () => {
      await initCommand({});

      const configContent = await fs.readFile("valnor.config.ts", "utf-8");

      expect(configContent).toContain(`import { defineConfig } from "valnor"`);
      expect(configContent).toContain(`plugin: "<SET ME>"`);
      expect(configContent).toContain(`defaultProfile: "dev"`);
      expect(configContent).toContain(`confirmMutations: true`);
   });

   it("should create valid query config file content", async () => {
      await initCommand({});

      const queryConfigContent = await fs.readFile("queries.valnor.ts", "utf-8");

      expect(queryConfigContent).toContain('import { defineQueryConfig } from "valnor"');
      expect(queryConfigContent).toContain('import { sql } from "valnor"');
      expect(queryConfigContent).toContain("exampleQuery");
   });

   it("should throw error if valnor.config.ts exists without force", async () => {
      await fs.writeFile("valnor.config.ts", "existing", "utf-8");

      await expect(initCommand({})).rejects.toThrow("valnor.config.ts already exists. Use --force to overwrite.");
   });

   it("should throw error if queries.valnor.ts exists without force", async () => {
      await fs.writeFile("queries.valnor.ts", "existing", "utf-8");

      await expect(initCommand({})).rejects.toThrow("queries.valnor.ts already exists. Use --force to overwrite.");
   });

   it("should overwrite existing files with force option", async () => {
      await fs.writeFile("valnor.config.ts", "existing config", "utf-8");
      await fs.writeFile("queries.valnor.ts", "existing queries", "utf-8");

      await initCommand({ force: true });

      const configContent = await fs.readFile("valnor.config.ts", "utf-8");
      const queryConfigContent = await fs.readFile("queries.valnor.ts", "utf-8");

      expect(configContent).not.toBe("existing config");
      expect(queryConfigContent).not.toBe("existing queries");
      expect(configContent).toContain("defineConfig");
      expect(queryConfigContent).toContain("defineQueryConfig");
   });
});
