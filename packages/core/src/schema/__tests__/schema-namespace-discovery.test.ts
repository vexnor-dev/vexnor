import { describe, expect, test, vi } from "vitest";
import { discoverSchemaNamespaces } from "#src/schema/schema-namespace-discovery.js";
import { MockPlugin } from "#src/test/mock-plugin.js";
import { loadPlugin } from "#src/load-plugin.js";

vi.mock("#src/load-plugin.js", () => ({ loadPlugin: vi.fn() }));

describe("discoverSchemaNamespaces", () => {
   test("loads and invokes a plugin schema-discovery capability", async () => {
      const plugin = new MockPlugin({ name: "@vexnor/discovery-test" });
      const discoverSchemas = vi.fn(async () => [
         { name: "alpha", system: false },
         { name: "system_catalog", system: true },
      ]);
      plugin.discoverSchemas = discoverSchemas;
      vi.mocked(loadPlugin).mockResolvedValue({ plugin, path: "@vexnor/discovery-test" });

      const result = await discoverSchemaNamespaces({
         plugin: "@vexnor/discovery-test",
         connection: { uri: "test://local" },
      });

      expect({ result, calls: discoverSchemas.mock.calls }).toMatchInlineSnapshot(`
        {
          "calls": [
            [
              {
                "uri": "test://local",
              },
            ],
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

   test("returns undefined when a plugin does not implement schema discovery", async () => {
      const plugin = new MockPlugin({ name: "@vexnor/no-discovery-test" });
      vi.mocked(loadPlugin).mockResolvedValue({ plugin, path: "@vexnor/no-discovery-test" });

      await expect(
         discoverSchemaNamespaces({
            plugin: "@vexnor/no-discovery-test",
            connection: { uri: "test://local" },
         }),
      ).resolves.toBeUndefined();
   });
});
