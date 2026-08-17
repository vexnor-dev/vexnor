import { createSchemaCatalog } from "@vexnor/core/schema";
import type { SqlSchema } from "@vexnor/core/plugin";
import { describe, expect, test } from "vitest";
import { VexnorMssql } from "#src/vexnor-mssql.js";

describe("MSSQL schema catalog", () => {
   test("normalizes introspection through the MSSQL type mapper", () => {
      const schema = {
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
                     ordinal_position: 1,
                     udt_name: "int",
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
      } satisfies SqlSchema;

      expect(createSchemaCatalog({ plugin: new VexnorMssql(), schema })).toMatchInlineSnapshot(`
        {
          "enums": [],
          "fingerprint": "86e44201f18782a874461a0c6b7f61f05852be9112cfa2903d299bbc012d8f10",
          "formatVersion": 1,
          "objects": [
            {
              "capabilities": {
                "automaticJoin": false,
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
                  "id": "alpha.record.record_id",
                  "identity": false,
                  "identityGeneration": null,
                  "mappingName": "record_id",
                  "nativeType": "int",
                  "normalizedType": "number",
                  "nullable": false,
                  "ordinalPosition": 1,
                  "physicalName": "record_id",
                  "typeTree": null,
                  "updatable": true,
                  "warnings": [],
                },
              ],
              "id": "alpha.record",
              "kind": "table",
              "mappingName": "Record",
              "name": "record",
              "primaryKey": {
                "columns": [
                  "record_id",
                ],
                "constraintName": "record_pk",
              },
              "relationships": [],
              "schema": "alpha",
              "warnings": [],
            },
          ],
          "plugin": {
            "dialect": "tsql",
            "driver": "mssql",
            "name": "@vexnor/mssql",
            "version": "1.0.0-beta.3",
          },
          "schemas": [
            "alpha",
          ],
          "warnings": [],
        }
      `);
   });
});
