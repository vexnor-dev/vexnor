import { createSchemaCatalog } from "@vexnor/core/schema";
import type { SqlSchema } from "@vexnor/core/plugin";
import { describe, expect, test } from "vitest";
import { VexnorPostgres } from "#src/vexnor-postgres.js";

describe("PostgreSQL schema catalog", () => {
   test("normalizes introspection through the PostgreSQL type mapper", () => {
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
                     udt_name: "int4",
                  },
               ],
               primary_keys: [
                  {
                     table_schema: "alpha",
                     table_name: "record",
                     constraint_name: "record_pkey",
                     column_name: "record_id",
                     ordinal_position: 1,
                  },
               ],
               foreign_keys: [],
            },
         ],
      } satisfies SqlSchema;

      expect(createSchemaCatalog({ plugin: new VexnorPostgres(), schema })).toMatchInlineSnapshot(`
        {
          "enums": [],
          "fingerprint": "bdc38712aae2d5bf7cc686965afc030da237158637ab1f4d33c31827f847b58e",
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
                  "nativeType": "int4",
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
                "constraintName": "record_pkey",
              },
              "relationships": [],
              "schema": "alpha",
              "warnings": [],
            },
          ],
          "plugin": {
            "dialect": "postgresql",
            "driver": "postgres",
            "name": "@vexnor/postgres",
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
