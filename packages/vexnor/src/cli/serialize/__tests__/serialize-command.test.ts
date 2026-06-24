import { describe, test, expect } from "vitest";
import { serializeCommand } from "#/cli/serialize/serialize-command.js";

describe("serializeCommand", () => {
   test("throws when no files match the glob", async () => {
      await expect(
         serializeCommand({ input: "src/nonexistent-pattern-xyz/**/*.ts", output: "/tmp/vexnor-test-out", dialect: "postgresql" }),
      ).rejects.toThrow("No files found matching");
   });
});
