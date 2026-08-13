import { describe, expect, test, vi } from "vitest";
import { VexnorConnection, type SqlColumnInfo, type SqlColumnType, type SqlSchema } from "#src/plugin/plugin.js";
import { MockPlugin, type MockConnection } from "#src/test/mock-plugin.js";
import { createSchemaCatalog } from "#src/schema/schema-catalog.js";
import { resolveSchemaSelection } from "#src/schema/schema-selection.js";
import { schemaMcpCommand } from "#src/cli/schema/schema-mcp-command.js";

class McpPlugin extends MockPlugin {
   readonly version = "1.0.0";
   readonly driver = "mcp-command-test";
   readonly dialect = "sql";
   readonly close = vi.fn(async () => {});
   readonly connection: MockConnection;

   constructor() {
      const connection: MockConnection = { query: async () => ({ rows: [] }) };
      super({ name: "@vexnor/mcp-command-test" }, connection);
      this.connection = connection;
   }

   getColumnType(_column: SqlColumnInfo): SqlColumnType {
      return { type: "string" };
   }

   async getSchema(_args: { schemas: string[] }): Promise<SqlSchema> {
      return schema();
   }

   async createConnection<TContext extends Record<string, unknown>>(_args: { config: unknown }) {
      return new VexnorConnection<{ Connection: MockConnection; Context: TContext }>(this.connection, this.close, null);
   }
}

function schema(): SqlSchema {
   return {
      enums: [],
      tables: [
         {
            table_schema: "alpha",
            table_name: "record",
            table_type: "table",
            columns: [
               {
                  table_schema: "alpha",
                  table_name: "record",
                  column_name: "record_id",
                  column_default: null,
                  is_nullable: "NO",
                  is_updatable: "YES",
                  udt_name: "text",
               },
            ],
            primary_keys: [],
            foreign_keys: [],
         },
      ],
   };
}

function config() {
   return {
      defaultProfile: "dev",
      profiles: {
         dev: {
            plugin: "@vexnor/mcp-command-test",
            connection: { uri: "mcp-command-test://local" },
            generate: { schema: ["alpha"], outDir: "./generated", camelCaseColumns: true },
         },
      },
   };
}

async function storedSelection(plugin: McpPlugin) {
   const catalog = createSchemaCatalog({ plugin, schema: schema(), naming: { camelCaseColumns: true } });
   return resolveSchemaSelection({ catalog, request: { mode: "non-interactive", all: true } });
}

describe("schemaMcpCommand", () => {
   test("starts from the persisted selected profile and cleans up on a process signal", async () => {
      const plugin = new McpPlugin();
      const selection = await storedSelection(plugin);
      const removeSignalHandlers = vi.fn();
      const closeMcp = vi.fn(async () => {});
      let startArgs: Parameters<NonNullable<Parameters<typeof schemaMcpCommand>[1]>["startMcp"]>[0] | undefined;
      let signalHandler: (() => void) | undefined;
      let resolveClosed: (() => void) | undefined;
      const closed = new Promise<void>((resolve) => {
         resolveClosed = resolve;
      });

      await schemaMcpCommand(
         {
            config: "/project/vexnor.config.ts",
            tools: ["getSchema", "join"],
            maxRows: 25,
            timeoutMs: 2_000,
            maxConcurrency: 2,
         },
         {
            loadConfig: async () => config(),
            loadPlugin: async () => ({ plugin, path: "@vexnor/mcp-command-test" }),
            loadSelection: async () => ({ formatVersion: 1, profiles: { dev: selection.scope } }),
            startMcp: async (args) => {
               startArgs = args;
               args.signal?.addEventListener("abort", () => resolveClosed?.(), { once: true });
               queueMicrotask(() => signalHandler?.());
               return { close: closeMcp, closed };
            },
            onSignal: (handler) => {
               signalHandler = handler;
               return removeSignalHandlers;
            },
         },
      );

      expect({
         enabledTools: startArgs?.enabledTools,
         limits: startArgs?.session.limits,
         selected: startArgs?.session.mappings.mappings.map((mapping) => mapping.id),
         aborted: startArgs?.signal?.aborted,
         closeMcp: closeMcp.mock.calls,
         closeConnection: plugin.close.mock.calls,
         removeSignalHandlers: removeSignalHandlers.mock.calls,
      }).toMatchInlineSnapshot(`
        {
          "aborted": true,
          "closeConnection": [
            [
              {
                "query": [Function],
              },
            ],
          ],
          "closeMcp": [
            [],
          ],
          "enabledTools": [
            "getSchema",
            "join",
          ],
          "limits": {
            "maxConcurrency": 2,
            "maxRows": 25,
            "timeoutMs": 2000,
          },
          "removeSignalHandlers": [
            [],
          ],
          "selected": [
            "alpha.record",
          ],
        }
      `);
   });

   test("fails closed when the resolved profile has no persisted selection", async () => {
      const plugin = new McpPlugin();

      await expect(
         schemaMcpCommand(
            { tools: ["getSchema"] },
            {
               loadConfig: async () => config(),
               loadPlugin: async () => ({ plugin, path: "@vexnor/mcp-command-test" }),
               loadSelection: async () => ({ formatVersion: 1, profiles: {} }),
               startMcp: vi.fn(),
               onSignal: () => vi.fn(),
            },
         ),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
         `[SchemaConfigurationError: No persisted schema selection exists for profile 'dev'. Run 'vexnor schema select --profile dev' first.]`,
      );
      expect(plugin.close.mock.calls).toMatchInlineSnapshot(`[]`);
   });

   test("fails before introspection when the profile configuration is invalid", async () => {
      const plugin = new McpPlugin();
      const dependencies = {
         loadConfig: async () => ({ profiles: { dev: { connection: { uri: "mcp-command-test://local" } } } }),
         loadPlugin: async () => ({ plugin, path: "@vexnor/mcp-command-test" }),
         loadSelection: async () => ({ formatVersion: 1 as const, profiles: {} }),
         startMcp: vi.fn(),
         onSignal: () => vi.fn(),
      };

      await expect(schemaMcpCommand({ tools: ["getSchema"] }, dependencies)).rejects.toThrowErrorMatchingInlineSnapshot(
         `[SchemaConfigurationError: No Vexnor profile was specified and the config has no defaultProfile]`,
      );
      expect({ loadPlugin: dependencies.startMcp.mock.calls, close: plugin.close.mock.calls }).toMatchInlineSnapshot(`
        {
          "close": [],
          "loadPlugin": [],
        }
      `);
   });
});
