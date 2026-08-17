import { describe, expect, test } from "vitest";
import { SqlLiteralType, type SqlColumnInfo, type SqlSchema } from "#src/plugin/plugin.js";
import { createSchemaCatalog, type SchemaCatalogPluginSource } from "#src/schema/schema-catalog.js";
import { resolveSchemaSelection } from "#src/schema/schema-selection.js";
import { createRuntimeSchemaMappings } from "#src/schema/runtime-schema-mappings.js";
import { SchemaGraph } from "#src/execution/schema-graph.js";

const plugin: SchemaCatalogPluginSource = {
   name: "@vexnor/synthetic",
   version: "1.0.0",
   driver: "synthetic",
   dialect: "sqlite",
   getColumnType: (column) => ({ type: column.udt_name === "datetime" ? "Date" : "string" }),
};

function column(
   table_schema: string,
   table_name: string,
   column_name: string,
   options: Partial<SqlColumnInfo> = {},
): SqlColumnInfo {
   return {
      table_schema,
      table_name,
      column_name,
      column_default: null,
      is_nullable: "NO",
      is_updatable: "YES",
      udt_name: "text",
      ...options,
   };
}

function catalog() {
   const schema: SqlSchema = {
      enums: [],
      tables: [
         {
            table_schema: "alpha",
            table_name: "record",
            table_type: "table",
            columns: [
               column("alpha", "record", "tenant_id", { ordinal_position: 1 }),
               column("alpha", "record", "record_id", { ordinal_position: 2 }),
               column("alpha", "record", "created_at", {
                  ordinal_position: 3,
                  udt_name: "datetime",
                  column_default: "current_timestamp",
               }),
            ],
            primary_keys: [
               {
                  table_schema: "alpha",
                  table_name: "record",
                  constraint_name: "record_pk",
                  column_name: "tenant_id",
                  ordinal_position: 1,
               },
               {
                  table_schema: "alpha",
                  table_name: "record",
                  constraint_name: "record_pk",
                  column_name: "record_id",
                  ordinal_position: 2,
               },
            ],
            foreign_keys: [],
         },
         {
            table_schema: "beta",
            table_name: "event_log",
            table_type: "table",
            columns: [
               column("beta", "event_log", "tenant_id", { ordinal_position: 1 }),
               column("beta", "event_log", "record_id", { ordinal_position: 2 }),
               column("beta", "event_log", "message", { ordinal_position: 3, is_nullable: "YES" }),
            ],
            primary_keys: [],
            foreign_keys: [
               {
                  table_schema: "beta",
                  table_name: "event_log",
                  constraint_name: "event_record_fk",
                  column_name: "tenant_id",
                  referenced_table_schema: "alpha",
                  referenced_table_name: "record",
                  referenced_column_name: "tenant_id",
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
            ],
         },
         {
            table_schema: "beta",
            table_name: "event_view",
            table_type: "view",
            columns: [column("beta", "event_view", "message")],
            primary_keys: [],
            foreign_keys: [],
         },
      ],
   };
   return createSchemaCatalog({ plugin, schema, naming: { camelCaseColumns: true } });
}

describe("createRuntimeSchemaMappings", () => {
   test("creates selected mappings for PK, PK-less, and view objects with composite relationships", async () => {
      const currentCatalog = catalog();
      const selection = await resolveSchemaSelection({
         catalog: currentCatalog,
         request: { mode: "non-interactive", all: true },
      });
      const result = createRuntimeSchemaMappings({ catalog: currentCatalog, selection: selection.scope });

      expect({
         source: result.source,
         schemaKeys: Object.keys(result.schema),
         mappings: result.mappings.map(({ id, kind, table }) => ({
            id,
            kind,
            catalogId: table.catalogId,
            objectKind: table.objectKind,
            tableInfo: table.tableInfo,
            columns: table.colKeys,
            pk: table.pk,
            fk: table.fk,
            crud: table.crud,
            dbSchema: table.dbSchema,
            columnTypes: table.columnTypes,
         })),
      }).toMatchInlineSnapshot(`
        {
          "mappings": [
            {
              "catalogId": "alpha.record",
              "columnTypes": {
                "createdAt": "Date",
              },
              "columns": [
                "tenantId",
                "recordId",
                "createdAt",
              ],
              "crud": {
                "delete": true,
                "insert": true,
                "select": true,
                "update": true,
              },
              "dbSchema": {
                "createdAt": {
                  "dbType": "datetime",
                  "default": "current_timestamp",
                  "type": "Date",
                },
                "recordId": {
                  "dbType": "text",
                  "type": "string",
                },
                "tenantId": {
                  "dbType": "text",
                  "type": "string",
                },
              },
              "fk": [],
              "id": "alpha.record",
              "kind": "table",
              "objectKind": "table",
              "pk": [
                "tenantId",
                "recordId",
              ],
              "tableInfo": {
                "name": "record",
                "schema": "alpha",
              },
            },
            {
              "catalogId": "beta.event_log",
              "columnTypes": {},
              "columns": [
                "tenantId",
                "recordId",
                "message",
              ],
              "crud": {
                "delete": true,
                "insert": true,
                "select": true,
                "update": true,
              },
              "dbSchema": {
                "message": {
                  "dbType": "text",
                  "nullable": true,
                  "type": "string",
                },
                "recordId": {
                  "dbType": "text",
                  "type": "string",
                },
                "tenantId": {
                  "dbType": "text",
                  "type": "string",
                },
              },
              "fk": [
                {
                  "from": [
                    "tenantId",
                    "recordId",
                  ],
                  "to": {
                    "columns": [
                      "tenantId",
                      "recordId",
                    ],
                    "schema": "alpha",
                    "table": "record",
                  },
                },
              ],
              "id": "beta.event_log",
              "kind": "table",
              "objectKind": "table",
              "pk": [],
              "tableInfo": {
                "name": "event_log",
                "schema": "beta",
              },
            },
            {
              "catalogId": "beta.event_view",
              "columnTypes": {},
              "columns": [
                "message",
              ],
              "crud": {
                "delete": false,
                "insert": false,
                "select": true,
                "update": false,
              },
              "dbSchema": {
                "message": {
                  "dbType": "text",
                  "type": "string",
                },
              },
              "fk": [],
              "id": "beta.event_view",
              "kind": "view",
              "objectKind": "view",
              "pk": [],
              "tableInfo": {
                "name": "event_view",
                "schema": "beta",
              },
            },
          ],
          "schemaKeys": [
            "alpha.record",
            "beta.event_log",
            "beta.event_view",
          ],
          "source": "vexnor-local:59f1bf836d9a9fb9ee890dfbe77f71569204bc666ab10491f1e51fd62398d4ad",
        }
      `);
   });

   test("omits deselected objects and relationships that leave selected scope", async () => {
      const currentCatalog = catalog();
      const selection = await resolveSchemaSelection({
         catalog: currentCatalog,
         request: { mode: "non-interactive", include: ["beta.event_log", "beta.event_view"] },
      });
      const result = createRuntimeSchemaMappings({ catalog: currentCatalog, selection: selection.scope });

      expect(result.mappings.map(({ id, table }) => ({ id, fk: table.fk }))).toMatchInlineSnapshot(`
        [
          {
            "fk": [],
            "id": "beta.event_log",
          },
          {
            "fk": [],
            "id": "beta.event_view",
          },
        ]
      `);
   });

   test("uses qualified identities as keys when generated mapping names collide", async () => {
      const currentCatalog = createSchemaCatalog({
         plugin,
         schema: {
            enums: [],
            tables: ["alpha", "beta"].map((table_schema) => ({
               table_schema,
               table_name: "record",
               table_type: "table",
               columns: [column(table_schema, "record", "record_id")],
               primary_keys: [],
               foreign_keys: [],
            })),
         },
      });
      const selection = await resolveSchemaSelection({
         catalog: currentCatalog,
         request: { mode: "non-interactive", all: true },
      });

      expect(Object.keys(createRuntimeSchemaMappings({ catalog: currentCatalog, selection: selection.scope }).schema))
         .toMatchInlineSnapshot(`
        [
          "alpha.record",
          "beta.record",
        ]
      `);
   });

   test("omits unresolved UDT values while preserving catalog-backed enum values", async () => {
      const currentCatalog = createSchemaCatalog({
         plugin: {
            ...plugin,
            getColumnType: (currentColumn) => ({ type: "Udt", udt: currentColumn.udt_name }),
         },
         schema: {
            enums: [
               {
                  enum_schema: "alpha",
                  enum_name: "status_type",
                  enum_values: [
                     { enum_label: "active", ordinal_position: 1 },
                     { enum_label: "inactive", ordinal_position: 2 },
                  ],
               },
            ],
            tables: [
               {
                  table_schema: "alpha",
                  table_name: "record",
                  table_type: "table",
                  columns: [
                     column("alpha", "record", "status", { udt_name: "status_type" }),
                     column("alpha", "record", "external_status", { udt_name: "external_status_type" }),
                  ],
                  primary_keys: [],
                  foreign_keys: [],
               },
            ],
         },
      });
      const selection = await resolveSchemaSelection({
         catalog: currentCatalog,
         request: { mode: "non-interactive", all: true },
      });
      const table = createRuntimeSchemaMappings({ catalog: currentCatalog, selection: selection.scope }).mappings[0]!
         .table;

      expect({
         known: table.dbSchema.status,
         unresolved: table.dbSchema.external_status,
         unresolvedHasValues: Object.hasOwn(table.dbSchema.external_status!, "values"),
      }).toMatchInlineSnapshot(`
        {
          "known": {
            "dbType": "status_type",
            "type": "Udt",
            "values": [
              "active",
              "inactive",
            ],
          },
          "unresolved": {
            "dbType": "external_status_type",
            "type": "Udt",
          },
          "unresolvedHasValues": false,
        }
      `);
   });

   test("preserves structured catalog types in runtime nested column accessors", async () => {
      const currentCatalog = createSchemaCatalog({
         plugin: {
            ...plugin,
            getColumnType: () => ({
               type: SqlLiteralType.Json,
               typeTree: {
                  kind: "struct",
                  fields: [
                     {
                        name: "shipping_address",
                        value: {
                           kind: "struct",
                           fields: [{ name: "tracking_code", value: { kind: "scalar", type: SqlLiteralType.String } }],
                        },
                     },
                  ],
               },
            }),
         },
         schema: {
            enums: [],
            tables: [
               {
                  table_schema: "alpha",
                  table_name: "shipment",
                  table_type: "table",
                  columns: [
                     column("alpha", "shipment", "shipping_details", {
                        data_type: "STRUCT(shipping_address STRUCT(tracking_code VARCHAR))",
                        is_nullable: "YES",
                        udt_name: undefined,
                     }),
                  ],
                  primary_keys: [],
                  foreign_keys: [],
               },
            ],
         },
         naming: { camelCaseColumns: true },
      });
      const selection = await resolveSchemaSelection({
         catalog: currentCatalog,
         request: { mode: "non-interactive", all: true },
      });
      const table = createRuntimeSchemaMappings({
         catalog: currentCatalog,
         selection: selection.scope,
      }).mappings[0]!.table;
      const shippingDetails = table.$shippingDetails;
      if (!shippingDetails) throw new Error("Expected shippingDetails column");
      const shippingAddress = shippingDetails.getNestedColumn("shippingAddress");
      if (!shippingAddress) throw new Error("Expected shippingAddress column");
      const trackingCode = shippingAddress.getNestedColumn("trackingCode");
      if (!trackingCode) throw new Error("Expected trackingCode column");

      expect({
         typeTree: currentCatalog.objects[0]!.columns[0]!.typeTree,
         dbSchema: table.dbSchema.shippingDetails,
         nestedColumn: {
            columnName: trackingCode.columnName,
            key: trackingCode.key,
            path: trackingCode.path,
         },
      }).toMatchInlineSnapshot(`
        {
          "dbSchema": {
            "dbType": "STRUCT(shipping_address STRUCT(tracking_code VARCHAR))",
            "nullable": true,
            "structure": {
              "fields": {
                "shippingAddress": {
                  "fieldName": "shipping_address",
                  "structure": {
                    "fields": {
                      "trackingCode": {
                        "fieldName": "tracking_code",
                      },
                    },
                    "kind": "struct",
                  },
                },
              },
              "kind": "struct",
            },
            "type": "Json",
          },
          "nestedColumn": {
            "columnName": "shipping_details",
            "key": "trackingCode",
            "path": [
              "shipping_address",
              "tracking_code",
            ],
          },
          "typeTree": {
            "fields": [
              {
                "mappingName": "shippingAddress",
                "physicalName": "shipping_address",
                "value": {
                  "fields": [
                    {
                      "mappingName": "trackingCode",
                      "physicalName": "tracking_code",
                      "value": {
                        "kind": "scalar",
                        "type": "string",
                        "udt": null,
                      },
                    },
                  ],
                  "kind": "struct",
                },
              },
            ],
            "kind": "struct",
          },
        }
      `);
   });

   test("builds a selected graph containing PK-less tables and views with complete composite join paths", async () => {
      const currentCatalog = catalog();
      const selection = await resolveSchemaSelection({
         catalog: currentCatalog,
         request: { mode: "non-interactive", all: true },
      });
      const mappings = createRuntimeSchemaMappings({ catalog: currentCatalog, selection: selection.scope });
      const graph = new SchemaGraph(mappings.schema, { include: "all-readable" });
      const join = graph.joinBy("beta.event_log", [{ table: "alpha.record" }]);

      expect({
         tables: graph.tables(),
         pkless: graph.table("beta.event_log"),
         view: graph.table("beta.event_view"),
         path: graph.joinPath("beta.event_log", "alpha.record"),
         join: join && { joinBy: join.joinBy, tables: join.tables, columns: join.columns },
      }).toMatchInlineSnapshot(`
        {
          "join": {
            "columns": [
              "tenantId",
              "recordId",
              "message",
              "record.tenantId",
              "record.recordId",
              "record.createdAt",
            ],
            "joinBy": {
              "record": {
                "on": [
                  [
                    "event_log.tenantId",
                    "=",
                    "record.tenantId",
                  ],
                  [
                    "event_log.recordId",
                    "=",
                    "record.recordId",
                  ],
                ],
              },
            },
            "tables": [
              "beta.event_log",
              "alpha.record",
            ],
          },
          "path": [
            {
              "columnPairs": [
                {
                  "from": {
                    "column": "tenantId",
                    "schema": "beta",
                    "table": "event_log",
                  },
                  "to": {
                    "column": "tenantId",
                    "schema": "alpha",
                    "table": "record",
                  },
                },
                {
                  "from": {
                    "column": "recordId",
                    "schema": "beta",
                    "table": "event_log",
                  },
                  "to": {
                    "column": "recordId",
                    "schema": "alpha",
                    "table": "record",
                  },
                },
              ],
              "from": {
                "column": "tenantId",
                "schema": "beta",
                "table": "event_log",
              },
              "to": {
                "column": "tenantId",
                "schema": "alpha",
                "table": "record",
              },
            },
          ],
          "pkless": {
            "columns": [
              {
                "name": "tenantId",
                "type": "text",
              },
              {
                "name": "recordId",
                "type": "text",
              },
              {
                "name": "message",
                "nullable": true,
                "type": "text",
              },
            ],
            "fk": [
              {
                "column": "tenantId",
                "columns": [
                  "tenantId",
                  "recordId",
                ],
                "targetColumn": "tenantId",
                "targetColumns": [
                  "tenantId",
                  "recordId",
                ],
                "targetTable": "alpha.record",
              },
            ],
            "kind": "table",
            "name": "event_log",
            "pk": [],
            "schema": "beta",
          },
          "tables": [
            "alpha.record",
            "beta.event_log",
            "beta.event_view",
          ],
          "view": {
            "columns": [
              {
                "name": "message",
                "type": "text",
              },
            ],
            "fk": [],
            "kind": "view",
            "name": "event_view",
            "pk": [],
            "schema": "beta",
          },
        }
      `);
   });

   test("rejects relationships that reference missing catalog columns", async () => {
      const missingSourceColumn = catalog();
      missingSourceColumn.objects.find(
         (object) => object.id === "beta.event_log",
      )!.relationships[0]!.columnPairs[0]!.from = "missing_tenant_id";
      const sourceSelection = await resolveSchemaSelection({
         catalog: missingSourceColumn,
         request: { mode: "non-interactive", all: true },
      });
      expect(() =>
         createRuntimeSchemaMappings({
            catalog: missingSourceColumn,
            selection: sourceSelection.scope,
         }),
      ).toThrowErrorMatchingInlineSnapshot(
         `[Error: Column is missing from schema catalog object beta.event_log: missing_tenant_id]`,
      );

      const missingTargetColumn = catalog();
      missingTargetColumn.objects.find(
         (object) => object.id === "beta.event_log",
      )!.relationships[0]!.columnPairs[0]!.to = "missing_tenant_id";
      const targetSelection = await resolveSchemaSelection({
         catalog: missingTargetColumn,
         request: { mode: "non-interactive", all: true },
      });
      expect(() =>
         createRuntimeSchemaMappings({
            catalog: missingTargetColumn,
            selection: targetSelection.scope,
         }),
      ).toThrowErrorMatchingInlineSnapshot(
         `[Error: Column is missing from schema catalog object alpha.record: missing_tenant_id]`,
      );
   });
});
