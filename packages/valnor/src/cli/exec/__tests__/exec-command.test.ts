import "./test-driver-setup.js";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { execCommand } from "../exec-command.js";
import { loadPlugin } from "../../../load-plugin.js";
import { join } from "path";
import { setTestMockData } from "./test-driver-setup.js";
import testPlugin from "./test-plugin.js";
import * as confirmPromptModule from "../confirm-prompt.js";

vi.mock("../../../load-plugin.js");
vi.mock("../confirm-prompt.js");

describe("execCommand", () => {
   const mockLoadPlugin = vi.mocked(loadPlugin);
   const mockCreateConnection = vi.spyOn(testPlugin, "createConnection");
   const mockConfirmPrompt = vi.mocked(confirmPromptModule.confirmPrompt);

   let consoleOutput: string[] = [];

   beforeEach(() => {
      vi.clearAllMocks();
      mockLoadPlugin.mockResolvedValue(testPlugin);
      mockConfirmPrompt.mockResolvedValue(true);
      consoleOutput = [];
      vi.spyOn(console, "log").mockImplementation((msg) => {
         consoleOutput.push(msg);
      });
   });

   test("throws when query config not provided", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");

      await expect(
         execCommand("findAccount", {
            config: configPath,
         }),
      ).rejects.toThrow("--query-config is required");
   });

   test("throws when query not found", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.valnor.ts");

      await expect(
         execCommand("nonExistent", {
            config: configPath,
            queryConfig: queryConfigPath,
         }),
      ).rejects.toThrow("Query 'nonExistent' not found in config");
   });

   test("throws when profile not found", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "bad-profile.valnor.ts");

      await expect(
         execCommand("findAccountById", {
            config: configPath,
            queryConfig: queryConfigPath,
         }),
      ).rejects.toThrow();
   });

   test("executes query with default params", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.valnor.ts");

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
      });

      expect(mockCreateConnection).toHaveBeenCalledWith({ uri: "test://localhost" });
   });

   test("dry run mode outputs SQL without executing", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.valnor.ts");

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
         dryRun: true,
      });

      expect(mockCreateConnection).not.toHaveBeenCalled();
   });

   test("closes connection on error", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.valnor.ts");
      mockCreateConnection.mockRejectedValueOnce(new Error("Connection error"));

      await expect(
         execCommand("findAccountById", {
            config: configPath,
            queryConfig: queryConfigPath,
         }),
      ).rejects.toThrow("Connection error");
   });

   test("outputs JSON format by default", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.valnor.ts");
      setTestMockData([
         { id: 1, name: "Alice", email: "alice@example.com" },
         { id: 2, name: "Bob", email: "bob@example.com" },
      ]);

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
      });

      expect(consoleOutput[0]).toMatchSnapshot();
   });

   test("outputs CSV format when specified", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.valnor.ts");
      setTestMockData([
         { id: 1, name: "Alice", email: "alice@example.com" },
         { id: 2, name: "Bob", email: "bob@example.com" },
      ]);

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
         format: "csv",
      });

      expect(consoleOutput[0]).toMatchSnapshot();
   });

   test("outputs table format when specified", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.valnor.ts");
      setTestMockData([
         { id: 1, name: "Alice", email: "alice@example.com" },
         { id: 2, name: "Bob", email: "bob@example.com" },
      ]);

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
         format: "table",
      });

      expect(consoleOutput[0]).toMatchSnapshot();
   });

   test("applies limit to results", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.valnor.ts");
      setTestMockData([
         { id: 1, name: "Alice" },
         { id: 2, name: "Bob" },
         { id: 3, name: "Charlie" },
      ]);

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
         limit: 2,
      });

      expect(consoleOutput[0]).toMatchSnapshot();
   });

   test("skips confirmation with --confirm flag", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "mutation-queries.valnor.ts");

      await execCommand("insertQuery", {
         config: configPath,
         queryConfig: queryConfigPath,
         confirm: true,
      });

      expect(mockConfirmPrompt).not.toHaveBeenCalled();
   });

   test("prompts for destructive queries by default", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "mutation-queries.valnor.ts");

      await execCommand("dropQuery", {
         config: configPath,
         queryConfig: queryConfigPath,
      });

      expect(mockConfirmPrompt).toHaveBeenCalledWith("⚠️  DESTRUCTIVE operation! Are you sure?", true);
   });

   test("cancels operation when confirmation denied", async () => {
      const configPath = join(__dirname, "fixtures", "valnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "mutation-queries.valnor.ts");
      mockConfirmPrompt.mockResolvedValueOnce(false);

      await execCommand("dropQuery", {
         config: configPath,
         queryConfig: queryConfigPath,
      });

      expect(mockCreateConnection).not.toHaveBeenCalled();
      expect(consoleOutput).toContain("Operation cancelled");
   });
});
