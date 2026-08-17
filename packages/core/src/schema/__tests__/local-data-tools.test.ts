import { describe, expect, test, vi } from "vitest";
import { VexnorConnection, type SqlColumnInfo, type SqlColumnType, type SqlSchema } from "#src/plugin/plugin.js";
import { MockPlugin, type MockConnection } from "#src/test/mock-plugin.js";
import { createSchemaCatalog } from "#src/schema/schema-catalog.js";
import { resolveSchemaSelection } from "#src/schema/schema-selection.js";
import { createLocalDataSession } from "#src/schema/local-data-session.js";
import { createLocalDataTools } from "#src/schema/local-data-tools.js";

const PLUGIN_NAME = "@vexnor/local-tools-test";

const catalogPlugin = {
   name: PLUGIN_NAME,
   version: "1.0.0",
   driver: "test",
   dialect: "sql",
   getColumnType(_column: SqlColumnInfo): SqlColumnType {
      return { type: "string" };
   },
};

function column(table_schema: string, table_name: string, column_name: string): SqlColumnInfo {
   return {
      table_schema,
      table_name,
      column_name,
      column_default: null,
      is_nullable: "NO",
      is_updatable: "YES",
      udt_name: "text",
   };
}

function table(
   table_schema: string,
   table_name: string,
   table_type: "table" | "view",
   columns: string[],
   primaryKey: string[] = [],
): SqlSchema["tables"][number] {
   return {
      table_schema,
      table_name,
      table_type,
      columns: columns.map((name) => column(table_schema, table_name, name)),
      primary_keys: primaryKey.map((column_name, index) => ({
         table_schema,
         table_name,
         constraint_name: `${table_name}_pk`,
         column_name,
         ordinal_position: index + 1,
      })),
      foreign_keys: [],
   };
}

function catalog() {
   const eventLog = table("beta", "event_log", "table", ["event_id", "partition_id", "record_id", "hidden_id"]);
   eventLog.foreign_keys = [
      {
         table_schema: "beta",
         table_name: "event_log",
         constraint_name: "event_record_fk",
         column_name: "partition_id",
         referenced_table_schema: "alpha",
         referenced_table_name: "record",
         referenced_column_name: "partition_id",
         ordinal_position: 1,
      },
      {
         table_schema: "beta",
         table_name: "event_log",
         constraint_name: "event_record_fk",
         column_name: "record_id",
         referenced_table_schema: "alpha",
         referenced_table_name: "record",
         referenced_column_name: "record_id",
         ordinal_position: 2,
      },
      {
         table_schema: "beta",
         table_name: "event_log",
         constraint_name: "event_hidden_fk",
         column_name: "hidden_id",
         referenced_table_schema: "beta",
         referenced_table_name: "hidden_record",
         referenced_column_name: "hidden_id",
         ordinal_position: 1,
      },
   ];
   return createSchemaCatalog({
      plugin: catalogPlugin,
      naming: { camelCaseColumns: true },
      schema: {
         enums: [
            {
               enum_schema: "alpha",
               enum_name: "record_state",
               enum_values: [{ enum_label: "active", ordinal_position: 1 }],
            },
            {
               enum_schema: "beta",
               enum_name: "event_state",
               enum_values: [{ enum_label: "pending", ordinal_position: 1 }],
            },
         ],
         tables: [
            table("alpha", "record", "table", ["partition_id", "record_id", "label"], ["partition_id", "record_id"]),
            eventLog,
            table("beta", "event_view", "view", ["event_id"]),
            table("beta", "hidden_record", "table", ["hidden_id"], ["hidden_id"]),
         ],
      },
   });
}

async function session() {
   const query = vi.fn();
   query.mockImplementation(async () => ({
      rows: [{ eventId: "event-1", partitionId: "partition-1", recordId: "record-1" }],
   }));
   const db: MockConnection = { query };
   const plugin = new MockPlugin({ name: PLUGIN_NAME });
   const currentCatalog = catalog();
   const selection = await resolveSchemaSelection({
      catalog: currentCatalog,
      request: {
         mode: "non-interactive",
         include: ["alpha.record", "beta.event_log", "beta.event_view"],
      },
   });
   const close = vi.fn(async () => {});
   const localSession = await createLocalDataSession({
      plugin,
      connection: new VexnorConnection(db, close, null),
      catalog: currentCatalog,
      selection: selection.scope,
      limits: { maxRows: 10, timeoutMs: 1000, maxConcurrency: 2 },
   });
   return { localSession, query, close };
}

describe("createLocalDataTools", () => {
   test("lists only selected schemas and readable objects with registered query metadata", async () => {
      const { localSession } = await session();
      const tools = createLocalDataTools(localSession);

      expect(await tools.getSchema({})).toMatchInlineSnapshot(`
        {
          "catalog": {
            "fingerprint": "c7be75a026026f295859d9ade9adf284ea750a3bff941da6404522ae4b5faf26",
            "formatVersion": 1,
          },
          "plugin": {
            "dialect": "sql",
            "driver": "test",
            "name": "@vexnor/local-tools-test",
            "version": "1.0.0",
          },
          "schemas": [
            {
              "name": "alpha",
              "objects": [
                {
                  "capabilities": {
                    "automaticJoin": true,
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
                  ],
                  "mappingName": "Record",
                  "name": "record",
                  "query": {
                    "columns": [
                      "partitionId",
                      "recordId",
                      "label",
                    ],
                    "hash": "4817c64a52f660477ddd7cc521b5b64d05f3594781e4d284dbd381203b6fdfa0",
                    "kind": "read",
                    "name": "read_alpha_record",
                    "objectIds": [
                      "alpha.record",
                    ],
                    "plugin": "@vexnor/local-tools-test",
                  },
                  "schema": "alpha",
                },
              ],
            },
            {
              "name": "beta",
              "objects": [
                {
                  "capabilities": {
                    "automaticJoin": true,
                    "deletable": false,
                    "insertable": false,
                    "readable": true,
                    "stableIdentity": false,
                    "updatable": false,
                  },
                  "id": "beta.event_log",
                  "kind": "table",
                  "limitations": [
                    "mutations-disabled",
                    "no-stable-identity",
                  ],
                  "mappingName": "EventLog",
                  "name": "event_log",
                  "query": {
                    "columns": [
                      "eventId",
                      "partitionId",
                      "recordId",
                      "hiddenId",
                    ],
                    "hash": "7c897cdb23560b9a121211ab572f6fd494ca9e2a84a0d1361bc1e508690d136e",
                    "kind": "read",
                    "name": "read_beta_event_log",
                    "objectIds": [
                      "beta.event_log",
                    ],
                    "plugin": "@vexnor/local-tools-test",
                  },
                  "schema": "beta",
                },
                {
                  "capabilities": {
                    "automaticJoin": false,
                    "deletable": false,
                    "insertable": false,
                    "readable": true,
                    "stableIdentity": false,
                    "updatable": false,
                  },
                  "id": "beta.event_view",
                  "kind": "view",
                  "limitations": [
                    "mutations-disabled",
                    "no-stable-identity",
                    "no-known-selected-relationship",
                  ],
                  "mappingName": "EventView",
                  "name": "event_view",
                  "query": {
                    "columns": [
                      "eventId",
                    ],
                    "hash": "1bdc04fdf14b2d2dc1159f67f04a6993b27e08ac92702f18da88fe50306d3556",
                    "kind": "read",
                    "name": "read_beta_event_view",
                    "objectIds": [
                      "beta.event_view",
                    ],
                    "plugin": "@vexnor/local-tools-test",
                  },
                  "schema": "beta",
                },
              ],
            },
          ],
          "warnings": [],
        }
      `);

      await localSession.close();
   });

   test("rejects selected objects without a registered read query", async () => {
      const { localSession } = await session();
      Object.defineProperty(localSession, "queries", { configurable: true, value: [] });
      const tools = createLocalDataTools(localSession);

      await expect(tools.getSchema()).rejects.toThrowErrorMatchingInlineSnapshot(
         `[InvalidLocalQueryParametersError: Missing local read query for selected schema object: alpha.record]`,
      );
      await localSession.close();
   });

   test("returns one selected object's complete schema and selected relationships", async () => {
      const { localSession } = await session();
      const tools = createLocalDataTools(localSession);

      expect(await tools.getSchema({ table: "beta.event_log" })).toMatchInlineSnapshot(`
        {
          "catalog": {
            "fingerprint": "c7be75a026026f295859d9ade9adf284ea750a3bff941da6404522ae4b5faf26",
            "formatVersion": 1,
          },
          "object": {
            "capabilities": {
              "automaticJoin": true,
              "deletable": false,
              "insertable": false,
              "readable": true,
              "stableIdentity": false,
              "updatable": false,
            },
            "columns": [
              {
                "array": false,
                "customType": null,
                "dataType": null,
                "default": null,
                "domainName": null,
                "generated": false,
                "generationExpression": null,
                "id": "beta.event_log.event_id",
                "identity": false,
                "identityGeneration": null,
                "mappingName": "eventId",
                "nativeType": "text",
                "normalizedType": "string",
                "nullable": false,
                "ordinalPosition": 1,
                "physicalName": "event_id",
                "typeTree": null,
                "updatable": true,
                "warnings": [],
              },
              {
                "array": false,
                "customType": null,
                "dataType": null,
                "default": null,
                "domainName": null,
                "generated": false,
                "generationExpression": null,
                "id": "beta.event_log.partition_id",
                "identity": false,
                "identityGeneration": null,
                "mappingName": "partitionId",
                "nativeType": "text",
                "normalizedType": "string",
                "nullable": false,
                "ordinalPosition": 2,
                "physicalName": "partition_id",
                "typeTree": null,
                "updatable": true,
                "warnings": [],
              },
              {
                "array": false,
                "customType": null,
                "dataType": null,
                "default": null,
                "domainName": null,
                "generated": false,
                "generationExpression": null,
                "id": "beta.event_log.record_id",
                "identity": false,
                "identityGeneration": null,
                "mappingName": "recordId",
                "nativeType": "text",
                "normalizedType": "string",
                "nullable": false,
                "ordinalPosition": 3,
                "physicalName": "record_id",
                "typeTree": null,
                "updatable": true,
                "warnings": [],
              },
              {
                "array": false,
                "customType": null,
                "dataType": null,
                "default": null,
                "domainName": null,
                "generated": false,
                "generationExpression": null,
                "id": "beta.event_log.hidden_id",
                "identity": false,
                "identityGeneration": null,
                "mappingName": "hiddenId",
                "nativeType": "text",
                "normalizedType": "string",
                "nullable": false,
                "ordinalPosition": 4,
                "physicalName": "hidden_id",
                "typeTree": null,
                "updatable": true,
                "warnings": [],
              },
            ],
            "enums": [
              {
                "id": "beta.event_state",
                "name": "event_state",
                "schema": "beta",
                "values": [
                  "pending",
                ],
              },
            ],
            "id": "beta.event_log",
            "kind": "table",
            "limitations": [
              "mutations-disabled",
              "no-stable-identity",
            ],
            "mappingName": "EventLog",
            "name": "event_log",
            "primaryKey": null,
            "query": {
              "columns": [
                "eventId",
                "partitionId",
                "recordId",
                "hiddenId",
              ],
              "hash": "7c897cdb23560b9a121211ab572f6fd494ca9e2a84a0d1361bc1e508690d136e",
              "kind": "read",
              "name": "read_beta_event_log",
              "objectIds": [
                "beta.event_log",
              ],
              "plugin": "@vexnor/local-tools-test",
            },
            "relationships": [
              {
                "columnPairs": [
                  {
                    "from": "partition_id",
                    "to": "partition_id",
                  },
                  {
                    "from": "record_id",
                    "to": "record_id",
                  },
                ],
                "constraintName": "event_record_fk",
                "fromObject": "beta.event_log",
                "toObject": "alpha.record",
              },
            ],
            "schema": "beta",
            "warnings": [],
          },
          "plugin": {
            "dialect": "sql",
            "driver": "test",
            "name": "@vexnor/local-tools-test",
            "version": "1.0.0",
          },
          "warnings": [],
        }
      `);

      const record = await tools.getSchema({ table: "alpha.record" });
      if (!("object" in record)) throw new Error("Expected detailed schema result");
      expect({
         primaryKey: record.object.primaryKey,
         relationships: record.object.relationships,
         enums: record.object.enums,
      }).toMatchInlineSnapshot(`
        {
          "enums": [
            {
              "id": "alpha.record_state",
              "name": "record_state",
              "schema": "alpha",
              "values": [
                "active",
              ],
            },
          ],
          "primaryKey": {
            "columns": [
              "partition_id",
              "record_id",
            ],
            "constraintName": "record_pk",
          },
          "relationships": [
            {
              "columnPairs": [
                {
                  "from": "partition_id",
                  "to": "partition_id",
                },
                {
                  "from": "record_id",
                  "to": "record_id",
                },
              ],
              "constraintName": "event_record_fk",
              "fromObject": "beta.event_log",
              "toObject": "alpha.record",
            },
          ],
        }
      `);

      await expect(tools.getSchema({ table: "beta.hidden_record" })).rejects.toThrowErrorMatchingInlineSnapshot(
         `[InvalidLocalQueryParametersError: Unknown selected schema object: beta.hidden_record]`,
      );
      await localSession.close();
   });

   test("registers joins and auto-injects their selected relationship parameters during fetch", async () => {
      const { localSession, query } = await session();
      const tools = createLocalDataTools(localSession);
      const registered = await tools.join({
         root: { schema: "beta", table: "event_log" },
         targets: [{ schema: "alpha", table: "record", type: "left" }],
      });

      expect(registered).toMatchInlineSnapshot(`
        {
          "columns": [
            "eventId",
            "partitionId",
            "recordId",
            "hiddenId",
            "record.partitionId",
            "record.recordId",
            "record.label",
          ],
          "hash": "2fd05a4e95046f04c6722d0ecee384ecd55db902cd0425eb01cc2d7f2b87b427",
          "joinBy": {
            "record": {
              "on": [
                [
                  "event_log.partitionId",
                  "=",
                  "record.partitionId",
                ],
                [
                  "event_log.recordId",
                  "=",
                  "record.recordId",
                ],
              ],
              "type": "left",
            },
          },
          "kind": "join",
          "name": "join_2fd05a4e95046f04",
          "objectIds": [
            "beta.event_log",
            "alpha.record",
          ],
          "plugin": "@vexnor/local-tools-test",
        }
      `);

      const result = await tools.fetchData({
         plugin: registered.plugin,
         hash: registered.hash,
         params: { limit: 100 },
      });
      expect({ result, calls: query.mock.calls }).toMatchInlineSnapshot(`
        {
          "calls": [
            [
              "/* <query_0> */
        SELECT
          "el_1"."event_id" AS "eventId",
          "el_1"."partition_id" AS "partitionId",
          "el_1"."record_id" AS "recordId",
          "el_1"."hidden_id" AS "hiddenId"
        FROM
          "beta"."event_log" AS "el_1"
          LEFT JOIN "alpha"."record" AS "r_2" ON "el_1"."partition_id" = "r_2"."partition_id"
          AND "el_1"."record_id" = "r_2"."record_id"
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
                10,
              ],
            ],
          ],
          "result": {
            "data": [
              {
                "eventId": "event-1",
                "partitionId": "partition-1",
                "recordId": "record-1",
              },
            ],
            "rowCount": 1,
          },
        }
      `);

      await localSession.close();
   });

   test("delegates single-object fetches and preserves local-session validation", async () => {
      const { localSession, query } = await session();
      const tools = createLocalDataTools(localSession);
      const registered = localSession.queries.find((entry) => entry.objectIds[0] === "beta.event_view")!;

      const result = await tools.fetchData({
         plugin: registered.plugin,
         hash: registered.hash,
         params: {},
      });
      expect({ result, calls: query.mock.calls }).toMatchInlineSnapshot(`
        {
          "calls": [
            [
              "/* <query_0> */
        SELECT
          "ev_1"."event_id" AS "eventId"
        FROM
          "beta"."event_view" AS "ev_1"
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
                10,
              ],
            ],
          ],
          "result": {
            "data": [
              {
                "eventId": "event-1",
                "partitionId": "partition-1",
                "recordId": "record-1",
              },
            ],
            "rowCount": 1,
          },
        }
      `);

      await expect(
         tools.fetchData({
            plugin: registered.plugin,
            hash: registered.hash,
            params: { unknown: true },
         }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
         `[InvalidLocalQueryParametersError: Unknown local data query parameters: unknown]`,
      );
      query.mockResolvedValueOnce(null);
      await expect(
         tools.fetchData({
            plugin: registered.plugin,
            hash: registered.hash,
            params: {},
         }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
         `[InvalidLocalQueryParametersError: Local data query result must be an object]`,
      );
      await expect(
         tools.fetchData({
            plugin: registered.plugin,
            hash: "unknown-hash",
            params: {},
         }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
         `[InvalidLocalQueryParametersError: Unknown local data query hash: unknown-hash]`,
      );
      await localSession.close();
   });

   test("rejects malformed tool requests before calling the session", async () => {
      const { localSession, query } = await session();
      const tools = createLocalDataTools(localSession);
      const errors: Record<string, string> = {};

      for (const [name, execute] of [
         ["schema", () => tools.getSchema({ table: "" })],
         // @ts-expect-error — verifies the runtime boundary used by MCP input.
         ["schemaProperty", () => tools.getSchema({ unknown: true })],
         ["join", () => tools.join({ root: { schema: "beta", table: "event_log" }, targets: [] })],
         [
            "joinType",
            () =>
               tools.join({
                  root: { schema: "beta", table: "event_log" },
                  targets: [
                     {
                        schema: "alpha",
                        table: "record",
                        // @ts-expect-error — verifies the runtime boundary used by MCP input.
                        type: "sideways",
                     },
                  ],
               }),
         ],
         ["fetch", () => tools.fetchData({ plugin: "", hash: "hash", params: {} })],
         [
            "fetchParams",
            () =>
               tools.fetchData({
                  plugin: PLUGIN_NAME,
                  hash: "hash",
                  // @ts-expect-error — verifies the runtime boundary used by MCP input.
                  params: [],
               }),
         ],
      ] as const) {
         try {
            await execute();
         } catch (error) {
            if (!(error instanceof Error)) throw error;
            errors[name] = error.message;
         }
      }

      expect({ errors, calls: query.mock.calls }).toMatchInlineSnapshot(`
        {
          "calls": [],
          "errors": {
            "fetch": "fetchData plugin must be a non-empty string",
            "fetchParams": "fetchData params must be an object",
            "join": "Local data join requires at least one target",
            "joinType": "Unknown local data join type: sideways",
            "schema": "getSchema table must be a non-empty string",
            "schemaProperty": "Unknown getSchema request properties: unknown",
          },
        }
      `);
      await localSession.close();
   });
});
