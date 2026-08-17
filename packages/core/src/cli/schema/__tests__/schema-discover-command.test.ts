import { describe, expect, test, vi } from "vitest";
import { schemaDiscoverCommand } from "#src/cli/schema/schema-discover-command.js";

function config() {
   return {
      defaultProfile: "dev",
      profiles: {
         dev: {
            plugin: "@vexnor/schema-test",
            connection: { uri: "schema-test://local" },
            generate: { schema: ["alpha"], outDir: "./generated" },
         },
      },
   };
}

describe("schemaDiscoverCommand", () => {
   test("prints discovered user and system namespaces", async () => {
      const output: string[] = [];
      const discover = vi.fn(async () => [
         { name: "alpha", system: false },
         { name: "system_catalog", system: true },
      ]);

      const result = await schemaDiscoverCommand(
         {},
         {
            loadConfig: async () => config(),
            discover,
            write: (message) => output.push(message),
         },
      );

      expect({ result, calls: discover.mock.calls, output }).toMatchInlineSnapshot(`
        {
          "calls": [
            [
              {
                "connection": {
                  "uri": "schema-test://local",
                },
                "plugin": "@vexnor/schema-test",
              },
            ],
          ],
          "output": [
            "Discovering schemas for profile 'dev'...",
            "Discovered 2 schemas:",
            "  [user] alpha",
            "  [system] system_catalog",
          ],
          "result": [
            {
              "name": "alpha",
              "system": false,
            },
            {
              "name": "system_catalog",
              "system": true,
            },
          ],
        }
      `);
   });

   test("reports plugins without discovery support", async () => {
      const output: string[] = [];
      const result = await schemaDiscoverCommand(
         {},
         {
            loadConfig: async () => config(),
            discover: async () => undefined,
            write: (message) => output.push(message),
         },
      );

      expect({ result, output }).toMatchInlineSnapshot(`
        {
          "output": [
            "Discovering schemas for profile 'dev'...",
            "Plugin '@vexnor/schema-test' does not support schema discovery.",
          ],
          "result": undefined,
        }
      `);
   });

   test("rejects an unknown profile before discovery", async () => {
      await expect(
         schemaDiscoverCommand(
            { profile: "missing" },
            {
               loadConfig: async () => config(),
               discover: vi.fn(),
               write: vi.fn(),
            },
         ),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`[SchemaConfigurationError: Unknown Vexnor profile: missing]`);
   });
});
