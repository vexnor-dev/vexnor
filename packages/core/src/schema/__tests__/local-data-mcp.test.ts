import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, test, vi } from "vitest";
import { VexnorConnection, type SqlColumnInfo, type SqlColumnType } from "#src/plugin/plugin.js";
import { createSchemaCatalog } from "#src/schema/schema-catalog.js";
import { resolveSchemaSelection } from "#src/schema/schema-selection.js";
import { createLocalDataSession } from "#src/schema/local-data-session.js";
import { startLocalDataMcpServer } from "#src/schema/local-data-mcp.js";
import { MockPlugin, type MockConnection } from "#src/test/mock-plugin.js";

const PLUGIN_NAME = "@vexnor/mcp-test";

async function createSession() {
   const query = vi.fn<MockConnection["query"]>();
   query.mockResolvedValue({ rows: [{ recordId: "record-1" }] });
   const close = vi.fn(async () => {});
   const db: MockConnection = { query };
   const plugin = new MockPlugin({ name: PLUGIN_NAME });
   const catalog = createSchemaCatalog({
      plugin: {
         name: PLUGIN_NAME,
         version: "1.0.0",
         driver: "test",
         dialect: "sql",
         getColumnType(_column: SqlColumnInfo): SqlColumnType {
            return { type: "string" };
         },
      },
      schema: {
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
               primary_keys: [
                  {
                     table_schema: "alpha",
                     table_name: "record",
                     constraint_name: "record_pk",
                     column_name: "record_id",
                     ordinal_position: 1,
                  },
               ],
               foreign_keys: [],
            },
         ],
      },
   });
   const selection = await resolveSchemaSelection({ catalog, request: { mode: "non-interactive", all: true } });
   const connection = new VexnorConnection(db, close, null);
   const session = await createLocalDataSession({
      plugin,
      connection,
      catalog,
      selection: selection.scope,
      limits: { maxRows: 5, timeoutMs: 1_000, maxConcurrency: 1 },
   });
   return { session, query, close };
}

async function connectClient(enabledTools: Array<"getSchema" | "join" | "fetchData">, signal?: AbortSignal) {
   const fixture = await createSession();
   const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
   const run = await startLocalDataMcpServer({
      session: fixture.session,
      enabledTools,
      transport: serverTransport,
      signal,
   });
   const client = new Client({ name: "local-data-mcp-test", version: "1.0.0" });
   await client.connect(clientTransport);
   return { ...fixture, client, run };
}

describe("startLocalDataMcpServer", () => {
   test("registers only the explicit enabled-tool allowlist and rejects disabled tools", async () => {
      const { client, run } = await connectClient(["getSchema", "join"]);

      expect(await client.listTools()).toMatchInlineSnapshot(`
        {
          "tools": [
            {
              "annotations": {
                "destructiveHint": false,
                "idempotentHint": true,
                "openWorldHint": false,
                "readOnlyHint": true,
              },
              "description": "List the selected datasource schema or inspect one selected table or view.",
              "inputSchema": {
                "additionalProperties": false,
                "properties": {
                  "table": {
                    "description": "Selected schema-qualified object identity",
                    "minLength": 1,
                    "type": "string",
                  },
                },
                "type": "object",
              },
              "name": "getSchema",
            },
            {
              "annotations": {
                "destructiveHint": false,
                "idempotentHint": true,
                "openWorldHint": false,
                "readOnlyHint": true,
              },
              "description": "Register a read-only query joining selected objects through known selected relationships.",
              "inputSchema": {
                "additionalProperties": false,
                "properties": {
                  "root": {
                    "additionalProperties": false,
                    "properties": {
                      "schema": {
                        "minLength": 1,
                        "type": "string",
                      },
                      "table": {
                        "minLength": 1,
                        "type": "string",
                      },
                    },
                    "required": [
                      "schema",
                      "table",
                    ],
                    "type": "object",
                  },
                  "targets": {
                    "items": {
                      "additionalProperties": false,
                      "properties": {
                        "schema": {
                          "minLength": 1,
                          "type": "string",
                        },
                        "table": {
                          "minLength": 1,
                          "type": "string",
                        },
                        "type": {
                          "anyOf": [
                            {
                              "const": "inner",
                              "type": "string",
                            },
                            {
                              "const": "left",
                              "type": "string",
                            },
                            {
                              "const": "right",
                              "type": "string",
                            },
                            {
                              "const": "full",
                              "type": "string",
                            },
                            {
                              "const": "cross",
                              "type": "string",
                            },
                          ],
                        },
                      },
                      "required": [
                        "schema",
                        "table",
                      ],
                      "type": "object",
                    },
                    "minItems": 1,
                    "type": "array",
                  },
                },
                "required": [
                  "root",
                  "targets",
                ],
                "type": "object",
              },
              "name": "join",
            },
          ],
        }
      `);
      expect(await client.callTool({ name: "getSchema", arguments: {} })).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "text": "{"catalog":{"formatVersion":1,"fingerprint":"2f164791f5bae24d31d4f63725401fc425fa2ae8118d159fbbdb52aa183f7e4f"},"plugin":{"name":"@vexnor/mcp-test","version":"1.0.0","driver":"test","dialect":"sql"},"warnings":[],"schemas":[{"name":"alpha","objects":[{"id":"alpha.record","schema":"alpha","name":"record","kind":"table","mappingName":"Record","capabilities":{"readable":true,"insertable":false,"updatable":false,"deletable":false,"stableIdentity":true,"automaticJoin":false},"limitations":["mutations-disabled","no-known-selected-relationship"],"query":{"objectIds":["alpha.record"],"name":"read_alpha_record","plugin":"@vexnor/mcp-test","hash":"4817c64a52f660477ddd7cc521b5b64d05f3594781e4d284dbd381203b6fdfa0","columns":["record_id"],"kind":"read"}}]}]}",
              "type": "text",
            },
          ],
          "structuredContent": {
            "catalog": {
              "fingerprint": "2f164791f5bae24d31d4f63725401fc425fa2ae8118d159fbbdb52aa183f7e4f",
              "formatVersion": 1,
            },
            "plugin": {
              "dialect": "sql",
              "driver": "test",
              "name": "@vexnor/mcp-test",
              "version": "1.0.0",
            },
            "schemas": [
              {
                "name": "alpha",
                "objects": [
                  {
                    "capabilities": {
                      "automaticJoin": false,
                      "deletable": false,
                      "insertable": false,
                      "readable": true,
                      "stableIdentity": true,
                      "updatable": false,
                    },
                    "id": "alpha.record",
                    "kind": "table",
                    "limitations": [
                      "mutations-disabled",
                      "no-known-selected-relationship",
                    ],
                    "mappingName": "Record",
                    "name": "record",
                    "query": {
                      "columns": [
                        "record_id",
                      ],
                      "hash": "4817c64a52f660477ddd7cc521b5b64d05f3594781e4d284dbd381203b6fdfa0",
                      "kind": "read",
                      "name": "read_alpha_record",
                      "objectIds": [
                        "alpha.record",
                      ],
                      "plugin": "@vexnor/mcp-test",
                    },
                    "schema": "alpha",
                  },
                ],
              },
            ],
            "warnings": [],
          },
        }
      `);
      await expect(client.callTool({ name: "fetchData", arguments: {} })).rejects.toThrowErrorMatchingInlineSnapshot(
         `[McpError: MCP error -32602: MCP error -32602: Local data MCP tool is not enabled: fetchData]`,
      );

      await client.close();
      await run.closed;
   });

   test("validates tool arguments with TypeBox before dispatch", async () => {
      const { client, run, query } = await connectClient(["getSchema", "fetchData"]);

      await expect(
         client.callTool({ name: "getSchema", arguments: { table: 42 } }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
         `[McpError: MCP error -32602: MCP error -32602: Invalid arguments for local data MCP tool getSchema at /table: Expected string]`,
      );
      await expect(
         client.callTool({ name: "fetchData", arguments: { plugin: PLUGIN_NAME, hash: "hash", params: [] } }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
         `[McpError: MCP error -32602: MCP error -32602: Invalid arguments for local data MCP tool fetchData at /params: Expected object]`,
      );
      expect(query.mock.calls).toMatchInlineSnapshot(`[]`);

      await client.close();
      await run.closed;
   });

   test("dispatches registered fetches and returns structured MCP content", async () => {
      const { client, run, session, query } = await connectClient(["fetchData"]);
      const registered = session.queries[0]!;

      expect(
         await client.callTool({
            name: "fetchData",
            arguments: { plugin: registered.plugin, hash: registered.hash, params: { limit: 99 } },
         }),
      ).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "text": "{"data":[{"recordId":"record-1"}],"rowCount":1}",
              "type": "text",
            },
          ],
          "structuredContent": {
            "data": [
              {
                "recordId": "record-1",
              },
            ],
            "rowCount": 1,
          },
        }
      `);
      expect(query.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "/* <query_0> */
        SELECT
          "r_1"."record_id"
        FROM
          "alpha"."record" AS "r_1"
          /* <query_1> */
          /* </query_1> */
          /* <query_2> */
          /* </query_2> */
          /* <query_3> */
          /* </query_3> */
        LIMIT
          ?
          /* </query_0> */",
            [
              5,
            ],
          ],
        ]
      `);

      await client.close();
      await run.closed;
   });

   test("returns typed local errors without exposing unexpected execution failures", async () => {
      const { client, run, session, query } = await connectClient(["getSchema", "fetchData"]);

      expect(
         await client.callTool({
            name: "getSchema",
            arguments: { table: "alpha.missing" },
         }),
      ).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "text": "{"error":{"code":"INVALID_QUERY_PARAMETERS","name":"InvalidLocalQueryParametersError","message":"Unknown selected schema object: alpha.missing"}}",
              "type": "text",
            },
          ],
          "isError": true,
          "structuredContent": {
            "error": {
              "code": "INVALID_QUERY_PARAMETERS",
              "message": "Unknown selected schema object: alpha.missing",
              "name": "InvalidLocalQueryParametersError",
            },
          },
        }
      `);

      query.mockRejectedValueOnce(new Error("synthetic sensitive driver details"));
      const registered = session.queries[0]!;
      expect(
         await client.callTool({
            name: "fetchData",
            arguments: { plugin: registered.plugin, hash: registered.hash, params: {} },
         }),
      ).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "text": "{"error":{"code":"LOCAL_DATA_TOOL_FAILED","name":"Error","message":"Local data tool failed"}}",
              "type": "text",
            },
          ],
          "isError": true,
          "structuredContent": {
            "error": {
              "code": "LOCAL_DATA_TOOL_FAILED",
              "message": "Local data tool failed",
              "name": "Error",
            },
          },
        }
      `);

      await client.close();
      await run.closed;
   });

   test("closes the MCP transport and local data session exactly once on host cancellation", async () => {
      const controller = new AbortController();
      const { run, close } = await connectClient(["getSchema"], controller.signal);

      controller.abort();
      await run.closed;
      await run.close();

      expect(close.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "query": [MockFunction],
            },
          ],
        ]
      `);
   });

   test("rejects empty, duplicate, and unknown enabled-tool sets", async () => {
      const { session } = await createSession();
      const errors: string[] = [];

      for (const enabledTools of [[], ["getSchema", "getSchema"], ["getSchema", "querySql"]]) {
         try {
            await startLocalDataMcpServer({
               session,
               // @ts-expect-error -- verifies the runtime host boundary.
               enabledTools,
               transport: InMemoryTransport.createLinkedPair()[1],
            });
         } catch (error) {
            if (!(error instanceof Error)) throw error;
            errors.push(error.message);
         }
      }

      expect(errors).toMatchInlineSnapshot(`
        [
          "Local data MCP enabled-tool allowlist cannot be empty",
          "Duplicate local data MCP tool: getSchema",
          "Unknown local data MCP tool: querySql",
        ]
      `);
      await session.close();
   });

   test("closes the session when startup is already cancelled or transport startup fails", async () => {
      const cancelled = await createSession();
      const controller = new AbortController();
      controller.abort();
      await expect(
         startLocalDataMcpServer({
            session: cancelled.session,
            enabledTools: ["getSchema"],
            transport: InMemoryTransport.createLinkedPair()[1],
            signal: controller.signal,
         }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
         `[LocalDataSessionCancellationError: Local data MCP server startup was cancelled]`,
      );

      const failed = await createSession();
      const transport = {
         start: vi.fn(async () => {
            throw new Error("synthetic transport startup failure");
         }),
         send: vi.fn(async () => {}),
         close: vi.fn(async () => {}),
      };
      await expect(
         startLocalDataMcpServer({
            session: failed.session,
            enabledTools: ["getSchema"],
            transport,
         }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: synthetic transport startup failure]`);

      expect({ cancelled: cancelled.close.mock.calls, failed: failed.close.mock.calls }).toMatchInlineSnapshot(`
        {
          "cancelled": [
            [
              {
                "query": [MockFunction],
              },
            ],
          ],
          "failed": [
            [
              {
                "query": [MockFunction],
              },
            ],
          ],
        }
      `);
   });
});
