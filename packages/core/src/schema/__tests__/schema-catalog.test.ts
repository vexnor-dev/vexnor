import { describe, expect, test } from "vitest";
import { SqlLiteralType } from "#src/plugin/sql-literal.js";
import type { SqlColumnInfo, SqlSchema } from "#src/plugin/plugin.js";
import { MockPlugin } from "#src/test/mock-plugin.js";
import { createSchemaCatalog } from "#src/schema/schema-catalog.js";

class CatalogPlugin extends MockPlugin {
   override readonly version = "2.3.4";
   override readonly driver = "synthetic-driver";
   override readonly dialect = "synthetic-sql";

   constructor() {
      super({ name: "@vexnor/synthetic" });
   }

   override getColumnType(column: SqlColumnInfo) {
      switch (column.udt_name) {
         case "uuid":
         case "text":
            return { type: SqlLiteralType.String };
         case "int4":
            return { type: SqlLiteralType.Number };
         case "synthetic_state":
            return { type: SqlLiteralType.Udt, udt: "synthetic_state" };
         default:
            return { type: SqlLiteralType.Unknown };
      }
   }
}

const plugin = new CatalogPlugin();

function column(args: Partial<SqlColumnInfo> & Pick<SqlColumnInfo, "column_name" | "table_name">): SqlColumnInfo {
   return {
      column_default: null,
      is_nullable: "NO",
      is_updatable: "YES",
      table_schema: "alpha",
      ordinal_position: 1,
      udt_name: "text",
      ...args,
   };
}

function schema(): SqlSchema {
   return {
      enums: [
         {
            enum_name: "synthetic_state",
            enum_schema: "alpha",
            enum_values: [
               { enum_label: "queued", ordinal_position: 1 },
               { enum_label: "complete", ordinal_position: 2 },
            ],
         },
      ],
      tables: [
         {
            table_name: "line_item",
            table_schema: "beta",
            table_type: "table",
            columns: [
               column({ table_schema: "beta", table_name: "line_item", column_name: "parent_id", udt_name: "uuid", ordinal_position: 2 }),
               column({ table_schema: "beta", table_name: "line_item", column_name: "sequence_no", udt_name: "int4", ordinal_position: 1 }),
               column({ table_schema: "beta", table_name: "line_item", column_name: "payload", udt_name: "jsonb", ordinal_position: 3, is_nullable: "YES", is_updatable: "NO", is_generated: "ALWAYS", generation_expression: "synthetic_expression" }),
            ],
            primary_keys: [
               { constraint_name: "pk_line_item", table_schema: "beta", table_name: "line_item", column_name: "parent_id", ordinal_position: 2 },
               { constraint_name: "pk_line_item", table_schema: "beta", table_name: "line_item", column_name: "sequence_no", ordinal_position: 1 },
            ],
            foreign_keys: [
               { constraint_name: "fk_line_item_parent", table_schema: "beta", table_name: "line_item", column_name: "parent_id", referenced_table_schema: "alpha", referenced_table_name: "parent_record", referenced_column_name: "parent_id", ordinal_position: 2 },
               { constraint_name: "fk_line_item_parent", table_schema: "beta", table_name: "line_item", column_name: "sequence_no", referenced_table_schema: "alpha", referenced_table_name: "parent_record", referenced_column_name: "sequence_no", ordinal_position: 1 },
            ],
         },
         {
            table_name: "parent_record",
            table_schema: "alpha",
            table_type: "table",
            columns: [
               column({ table_name: "parent_record", column_name: "sequence_no", udt_name: "int4", ordinal_position: 2 }),
               column({ table_name: "parent_record", column_name: "parent_id", udt_name: "uuid", ordinal_position: 1 }),
               column({ table_name: "parent_record", column_name: "state", udt_name: "synthetic_state", data_type: "USER-DEFINED", ordinal_position: 3, column_default: "'queued'" }),
            ],
            primary_keys: [
               { constraint_name: "pk_parent_record", table_schema: "alpha", table_name: "parent_record", column_name: "parent_id", ordinal_position: 1 },
               { constraint_name: "pk_parent_record", table_schema: "alpha", table_name: "parent_record", column_name: "sequence_no", ordinal_position: 2 },
            ],
         },
         {
            table_name: "activity_view",
            table_schema: "alpha",
            table_type: "view",
            columns: [
               column({ table_name: "activity_view", column_name: "display_name", ordinal_position: 1, is_updatable: "NO" }),
            ],
            primary_keys: [],
         },
         {
            table_name: "event_log",
            table_schema: "alpha",
            table_type: "table",
            columns: [
               column({ table_name: "event_log", column_name: "event_id", udt_name: "uuid", ordinal_position: 1 }),
            ],
            primary_keys: [],
         },
      ],
   };
}

describe("createSchemaCatalog", () => {
   test("creates a complete deterministic catalog for tables, PK-less tables, views, enums, and composite relationships", () => {
      const catalog = createSchemaCatalog({
         plugin,
         schema: schema(),
         naming: { camelCaseColumns: true },
      });

      expect(catalog).toMatchInlineSnapshot(`
        {
          "enums": [
            {
              "id": "alpha.synthetic_state",
              "name": "synthetic_state",
              "schema": "alpha",
              "values": [
                "queued",
                "complete",
              ],
            },
          ],
          "fingerprint": "be691a89e3492ba3beabe35812e48319419afa791dbbe6a74fbc16670016d3d3",
          "formatVersion": 1,
          "objects": [
            {
              "capabilities": {
                "automaticJoin": false,
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
                  "id": "alpha.activity_view.display_name",
                  "identity": false,
                  "identityGeneration": null,
                  "mappingName": "displayName",
                  "nativeType": "text",
                  "normalizedType": "string",
                  "nullable": false,
                  "ordinalPosition": 1,
                  "physicalName": "display_name",
                  "updatable": false,
                  "warnings": [],
                },
              ],
              "id": "alpha.activity_view",
              "kind": "view",
              "mappingName": "ActivityView",
              "name": "activity_view",
              "primaryKey": null,
              "relationships": [],
              "schema": "alpha",
              "warnings": [],
            },
            {
              "capabilities": {
                "automaticJoin": false,
                "deletable": true,
                "insertable": true,
                "readable": true,
                "stableIdentity": false,
                "updatable": true,
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
                  "id": "alpha.event_log.event_id",
                  "identity": false,
                  "identityGeneration": null,
                  "mappingName": "eventId",
                  "nativeType": "uuid",
                  "normalizedType": "string",
                  "nullable": false,
                  "ordinalPosition": 1,
                  "physicalName": "event_id",
                  "updatable": true,
                  "warnings": [],
                },
              ],
              "id": "alpha.event_log",
              "kind": "table",
              "mappingName": "EventLog",
              "name": "event_log",
              "primaryKey": null,
              "relationships": [],
              "schema": "alpha",
              "warnings": [],
            },
            {
              "capabilities": {
                "automaticJoin": true,
                "deletable": true,
                "insertable": true,
                "readable": true,
                "stableIdentity": true,
                "updatable": true,
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
                  "id": "alpha.parent_record.parent_id",
                  "identity": false,
                  "identityGeneration": null,
                  "mappingName": "parentId",
                  "nativeType": "uuid",
                  "normalizedType": "string",
                  "nullable": false,
                  "ordinalPosition": 1,
                  "physicalName": "parent_id",
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
                  "id": "alpha.parent_record.sequence_no",
                  "identity": false,
                  "identityGeneration": null,
                  "mappingName": "sequenceNo",
                  "nativeType": "int4",
                  "normalizedType": "number",
                  "nullable": false,
                  "ordinalPosition": 2,
                  "physicalName": "sequence_no",
                  "updatable": true,
                  "warnings": [],
                },
                {
                  "array": false,
                  "customType": {
                    "import": null,
                    "insert": null,
                    "select": null,
                    "udt": "synthetic_state",
                  },
                  "dataType": "USER-DEFINED",
                  "default": "'queued'",
                  "domainName": null,
                  "generated": false,
                  "generationExpression": null,
                  "id": "alpha.parent_record.state",
                  "identity": false,
                  "identityGeneration": null,
                  "mappingName": "state",
                  "nativeType": "synthetic_state",
                  "normalizedType": "Udt",
                  "nullable": false,
                  "ordinalPosition": 3,
                  "physicalName": "state",
                  "updatable": true,
                  "warnings": [],
                },
              ],
              "id": "alpha.parent_record",
              "kind": "table",
              "mappingName": "ParentRecord",
              "name": "parent_record",
              "primaryKey": {
                "columns": [
                  "parent_id",
                  "sequence_no",
                ],
                "constraintName": "pk_parent_record",
              },
              "relationships": [],
              "schema": "alpha",
              "warnings": [],
            },
            {
              "capabilities": {
                "automaticJoin": true,
                "deletable": true,
                "insertable": true,
                "readable": true,
                "stableIdentity": true,
                "updatable": true,
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
                  "id": "beta.line_item.sequence_no",
                  "identity": false,
                  "identityGeneration": null,
                  "mappingName": "sequenceNo",
                  "nativeType": "int4",
                  "normalizedType": "number",
                  "nullable": false,
                  "ordinalPosition": 1,
                  "physicalName": "sequence_no",
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
                  "id": "beta.line_item.parent_id",
                  "identity": false,
                  "identityGeneration": null,
                  "mappingName": "parentId",
                  "nativeType": "uuid",
                  "normalizedType": "string",
                  "nullable": false,
                  "ordinalPosition": 2,
                  "physicalName": "parent_id",
                  "updatable": true,
                  "warnings": [],
                },
                {
                  "array": false,
                  "customType": null,
                  "dataType": null,
                  "default": null,
                  "domainName": null,
                  "generated": true,
                  "generationExpression": "synthetic_expression",
                  "id": "beta.line_item.payload",
                  "identity": false,
                  "identityGeneration": null,
                  "mappingName": "payload",
                  "nativeType": "jsonb",
                  "normalizedType": "unknown",
                  "nullable": true,
                  "ordinalPosition": 3,
                  "physicalName": "payload",
                  "updatable": false,
                  "warnings": [
                    {
                      "code": "unknown-column-type",
                      "message": "Column beta.line_item.payload uses an unsupported or unknown native type.",
                    },
                  ],
                },
              ],
              "id": "beta.line_item",
              "kind": "table",
              "mappingName": "LineItem",
              "name": "line_item",
              "primaryKey": {
                "columns": [
                  "sequence_no",
                  "parent_id",
                ],
                "constraintName": "pk_line_item",
              },
              "relationships": [
                {
                  "columnPairs": [
                    {
                      "from": "sequence_no",
                      "to": "sequence_no",
                    },
                    {
                      "from": "parent_id",
                      "to": "parent_id",
                    },
                  ],
                  "constraintName": "fk_line_item_parent",
                  "fromObject": "beta.line_item",
                  "toObject": "alpha.parent_record",
                },
              ],
              "schema": "beta",
              "warnings": [
                {
                  "code": "unknown-column-type",
                  "message": "Column beta.line_item.payload uses an unsupported or unknown native type.",
                },
              ],
            },
          ],
          "plugin": {
            "dialect": "synthetic-sql",
            "driver": "synthetic-driver",
            "name": "@vexnor/synthetic",
            "version": "2.3.4",
          },
          "schemas": [
            "alpha",
            "beta",
          ],
          "warnings": [],
        }
      `);
   });

   test("orders equivalent introspection input identically", () => {
      const first = schema();
      const second: SqlSchema = {
         enums: [...first.enums].reverse(),
         tables: [...first.tables]
            .reverse()
            .map((table) => ({
               ...table,
               columns: [...table.columns].reverse(),
               primary_keys: [...table.primary_keys].reverse(),
               foreign_keys: [...(table.foreign_keys ?? [])].reverse(),
            })),
      };

      const firstCatalog = createSchemaCatalog({ plugin, schema: first, naming: { camelCaseColumns: true } });
      const secondCatalog = createSchemaCatalog({ plugin, schema: second, naming: { camelCaseColumns: true } });

      expect({
         sameFingerprint: firstCatalog.fingerprint === secondCatalog.fingerprint,
         sameSerialization: JSON.stringify(firstCatalog) === JSON.stringify(secondCatalog),
      }).toMatchInlineSnapshot(`
        {
          "sameFingerprint": true,
          "sameSerialization": true,
        }
      `);
   });

   test("rejects duplicate object and column identities", () => {
      const duplicateObject = schema();
      duplicateObject.tables.push(duplicateObject.tables[0]!);

      expect(() => createSchemaCatalog({ plugin, schema: duplicateObject })).toThrowErrorMatchingInlineSnapshot(`[Error: Duplicate schema object identity: beta.line_item]`);

      const duplicateColumn = schema();
      duplicateColumn.tables[0]!.columns.push(duplicateColumn.tables[0]!.columns[0]!);

      expect(() => createSchemaCatalog({ plugin, schema: duplicateColumn })).toThrowErrorMatchingInlineSnapshot(`[Error: Duplicate column in beta.line_item identity: parent_id]`);

      const duplicateEnum = schema();
      duplicateEnum.enums.push(duplicateEnum.enums[0]!);
      expect(() => createSchemaCatalog({ plugin, schema: duplicateEnum })).toThrowErrorMatchingInlineSnapshot(`[Error: Duplicate schema enum identity: alpha.synthetic_state]`);

      const conflictingPrimaryKeys = schema();
      conflictingPrimaryKeys.tables[0]!.primary_keys[1]!.constraint_name = "pk_line_item_other";
      expect(() => createSchemaCatalog({ plugin, schema: conflictingPrimaryKeys })).toThrowErrorMatchingInlineSnapshot(`[Error: Expected one primary-key constraint, received: pk_line_item, pk_line_item_other]`);
   });

   test("uses deterministic fallbacks for missing metadata and records undeclared plugin versions", () => {
      const fallbackPlugin = {
         name: "@vexnor/fallback",
         version: "unknown",
         driver: "fallback",
         dialect: "fallback-sql",
         getColumnType(currentColumn: SqlColumnInfo) {
            return currentColumn.column_name === "left_id"
               ? {
                    type: SqlLiteralType.Udt,
                    udt: "fallback_state",
                    tsTypeSelect: "FallbackState",
                    tsTypeInsert: "FallbackStateInput",
                    tsImport: "@vexnor/fallback-types",
                    isArray: true,
                 }
               : { type: SqlLiteralType.String };
         },
      };
      const catalog = createSchemaCatalog({
         plugin: fallbackPlugin,
         schema: {
            enums: [
               {
                  enum_schema: "beta",
                  enum_name: "z_state",
                  enum_values: [{ enum_label: "z", ordinal_position: 1 }],
               },
               {
                  enum_schema: "alpha",
                  enum_name: "fallback_state",
                  enum_values: [
                     { enum_label: "queued", ordinal_position: 1 },
                     { enum_label: "complete", ordinal_position: 1 },
                  ],
               },
            ],
            tables: [
               {
                  table_schema: "alpha",
                  table_name: "target",
                  table_type: "table",
                  columns: [
                     column({ table_name: "target", column_name: "right_id", ordinal_position: 1 }),
                     column({ table_name: "target", column_name: "left_id", ordinal_position: 1 }),
                  ],
                  primary_keys: [
                     { table_schema: "alpha", table_name: "target", constraint_name: "target_pk", column_name: "right_id", ordinal_position: 1 },
                     { table_schema: "alpha", table_name: "target", constraint_name: "target_pk", column_name: "left_id", ordinal_position: 1 },
                  ],
                  foreign_keys: [],
               },
               {
                  table_schema: "beta",
                  table_name: "source",
                  table_type: "table",
                  columns: [
                     column({ table_schema: "beta", table_name: "source", column_name: "right_id", ordinal_position: 1, udt_name: undefined, data_type: undefined }),
                     column({ table_schema: "beta", table_name: "source", column_name: "left_id", ordinal_position: 1, is_identity: "YES", identity_generation: "BY DEFAULT" }),
                  ],
                  primary_keys: [],
                  foreign_keys: [
                     { table_schema: "beta", table_name: "source", constraint_name: "source_target_fk", column_name: "right_id", referenced_table_schema: "alpha", referenced_table_name: "target", referenced_column_name: "right_id", ordinal_position: 1 },
                     { table_schema: "beta", table_name: "source", constraint_name: "source_target_fk", column_name: "left_id", referenced_table_schema: "alpha", referenced_table_name: "target", referenced_column_name: "left_id", ordinal_position: 1 },
                  ],
               },
            ],
         },
      });

      expect({
         enums: catalog.enums,
         warnings: catalog.warnings,
         source: catalog.objects.find((object) => object.id === "beta.source"),
         targetPrimaryKey: catalog.objects.find((object) => object.id === "alpha.target")?.primaryKey,
      }).toMatchInlineSnapshot(`
        {
          "enums": [
            {
              "id": "alpha.fallback_state",
              "name": "fallback_state",
              "schema": "alpha",
              "values": [
                "complete",
                "queued",
              ],
            },
            {
              "id": "beta.z_state",
              "name": "z_state",
              "schema": "beta",
              "values": [
                "z",
              ],
            },
          ],
          "source": {
            "capabilities": {
              "automaticJoin": true,
              "deletable": true,
              "insertable": true,
              "readable": true,
              "stableIdentity": false,
              "updatable": true,
            },
            "columns": [
              {
                "array": true,
                "customType": {
                  "import": "@vexnor/fallback-types",
                  "insert": "FallbackStateInput",
                  "select": "FallbackState",
                  "udt": "fallback_state",
                },
                "dataType": null,
                "default": null,
                "domainName": null,
                "generated": false,
                "generationExpression": null,
                "id": "beta.source.left_id",
                "identity": true,
                "identityGeneration": "BY DEFAULT",
                "mappingName": "left_id",
                "nativeType": "text",
                "normalizedType": "Udt",
                "nullable": false,
                "ordinalPosition": 1,
                "physicalName": "left_id",
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
                "id": "beta.source.right_id",
                "identity": false,
                "identityGeneration": null,
                "mappingName": "right_id",
                "nativeType": "unknown",
                "normalizedType": "string",
                "nullable": false,
                "ordinalPosition": 1,
                "physicalName": "right_id",
                "updatable": true,
                "warnings": [],
              },
            ],
            "id": "beta.source",
            "kind": "table",
            "mappingName": "Source",
            "name": "source",
            "primaryKey": null,
            "relationships": [
              {
                "columnPairs": [
                  {
                    "from": "left_id",
                    "to": "left_id",
                  },
                  {
                    "from": "right_id",
                    "to": "right_id",
                  },
                ],
                "constraintName": "source_target_fk",
                "fromObject": "beta.source",
                "toObject": "alpha.target",
              },
            ],
            "schema": "beta",
            "warnings": [],
          },
          "targetPrimaryKey": {
            "columns": [
              "left_id",
              "right_id",
            ],
            "constraintName": "target_pk",
          },
          "warnings": [
            {
              "code": "missing-plugin-version",
              "message": "Plugin @vexnor/fallback did not declare a version.",
            },
          ],
        }
      `);
   });
});
