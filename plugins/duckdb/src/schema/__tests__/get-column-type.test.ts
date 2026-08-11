import { describe, expect, test } from "vitest";
import { getColumnType } from "#src/schema/get-column-type.js";

const base = {
   column_default: null,
   column_name: "value",
   is_nullable: "NO" as const,
   is_updatable: "YES" as const,
   table_schema: "main",
   table_name: "types",
};

describe("DuckDB getColumnType", () => {
   test("maps every supported type and the fallback", () => {
      const types = [
      "BOOLEAN",
      "TINYINT",
      "SMALLINT",
      "INTEGER",
      "BIGINT",
      "HUGEINT",
      "UTINYINT",
      "USMALLINT",
      "UINTEGER",
      "UBIGINT",
      "FLOAT",
      "DOUBLE",
      "DECIMAL(18,3)",
      "VARCHAR",
      "TEXT",
      "BLOB",
      "DATE",
      "TIME",
      "TIME WITH TIME ZONE",
      "TIMESTAMP",
      "TIMESTAMP WITH TIME ZONE",
      "INTERVAL",
      "UUID",
      "JSON",
      "INTEGER[]",
      "INTEGER[3]",
      "STRUCT(name VARCHAR, age INTEGER)",
      "MAP(VARCHAR, INTEGER)",
      "VARIANT",
      "UNION(num INTEGER, text VARCHAR)",
      "ENUM('open', 'closed')",
      "GEOMETRY",
      "UNKNOWN_TYPE",
      ];
      expect(Object.fromEntries(types.map((data_type) => [data_type, getColumnType({ ...base, data_type, udt_name: data_type })])))
         .toMatchInlineSnapshot(`
           {
             "BIGINT": {
               "type": "BigInt",
             },
             "BLOB": {
               "type": "Uint8Array",
             },
             "BOOLEAN": {
               "type": "boolean",
             },
             "DATE": {
               "type": "Date",
             },
             "DECIMAL(18,3)": {
               "type": "string",
             },
             "DOUBLE": {
               "type": "number",
             },
             "ENUM('open', 'closed')": {
               "type": "Udt",
               "udt": "ENUM('open', 'closed')",
             },
             "FLOAT": {
               "type": "number",
             },
             "GEOMETRY": {
               "type": "string",
             },
             "HUGEINT": {
               "type": "BigInt",
             },
             "INTEGER": {
               "type": "number",
             },
             "INTEGER[3]": {
               "isArray": true,
               "type": "Json",
             },
             "INTEGER[]": {
               "isArray": true,
               "type": "Json",
             },
             "INTERVAL": {
               "type": "string",
             },
             "JSON": {
               "type": "Json",
             },
             "MAP(VARCHAR, INTEGER)": {
               "type": "Json",
             },
             "SMALLINT": {
               "type": "number",
             },
             "STRUCT(name VARCHAR, age INTEGER)": {
               "type": "Json",
             },
             "TEXT": {
               "type": "string",
             },
             "TIME": {
               "type": "string",
             },
             "TIME WITH TIME ZONE": {
               "type": "string",
             },
             "TIMESTAMP": {
               "type": "Date",
             },
             "TIMESTAMP WITH TIME ZONE": {
               "type": "Date",
             },
             "TINYINT": {
               "type": "number",
             },
             "UBIGINT": {
               "type": "BigInt",
             },
             "UINTEGER": {
               "type": "number",
             },
             "UNION(num INTEGER, text VARCHAR)": {
               "type": "Json",
             },
             "UNKNOWN_TYPE": {
               "type": "unknown",
             },
             "USMALLINT": {
               "type": "number",
             },
             "UTINYINT": {
               "type": "number",
             },
             "UUID": {
               "type": "string",
             },
             "VARCHAR": {
               "type": "string",
             },
             "VARIANT": {
               "type": "Json",
             },
           }
         `);
   });

   test("maps information_schema user-defined columns through their UDT name", () => {
      expect(getColumnType({ ...base, data_type: "USER-DEFINED", udt_name: "account_status" }))
         .toMatchInlineSnapshot(`
           {
             "type": "Udt",
             "udt": "account_status",
           }
         `);
   });

   test("maps every DuckDB type alias", () => {
      const aliases = [
         "BOOL",
         "LOGICAL",
         "INT",
         "REAL",
         "UHUGEINT",
         "BIGNUM",
         "DECIMAL",
         "NUMERIC",
         "NUMERIC(18,3)",
         "CHAR",
         "BPCHAR",
         "STRING",
         "TIMETZ",
         "BIT",
         "BYTEA",
         "BINARY",
         "VARBINARY",
         "TIMESTAMP_S",
         "TIMESTAMP_MS",
         "TIMESTAMP_NS",
         "TIMESTAMPTZ",
      ];

      expect(Object.fromEntries(aliases.map((data_type) => [data_type, getColumnType({ ...base, data_type, udt_name: data_type })])))
         .toMatchInlineSnapshot(`
           {
             "BIGNUM": {
               "type": "BigInt",
             },
             "BINARY": {
               "type": "Uint8Array",
             },
             "BIT": {
               "type": "string",
             },
             "BOOL": {
               "type": "boolean",
             },
             "BPCHAR": {
               "type": "string",
             },
             "BYTEA": {
               "type": "Uint8Array",
             },
             "CHAR": {
               "type": "string",
             },
             "DECIMAL": {
               "type": "string",
             },
             "INT": {
               "type": "number",
             },
             "LOGICAL": {
               "type": "boolean",
             },
             "NUMERIC": {
               "type": "string",
             },
             "NUMERIC(18,3)": {
               "type": "string",
             },
             "REAL": {
               "type": "number",
             },
             "STRING": {
               "type": "string",
             },
             "TIMESTAMPTZ": {
               "type": "Date",
             },
             "TIMESTAMP_MS": {
               "type": "Date",
             },
             "TIMESTAMP_NS": {
               "type": "Date",
             },
             "TIMESTAMP_S": {
               "type": "Date",
             },
             "TIMETZ": {
               "type": "string",
             },
             "UHUGEINT": {
               "type": "BigInt",
             },
             "VARBINARY": {
               "type": "Uint8Array",
             },
           }
         `);
   });

   test("uses UDT and domain metadata fallbacks", () => {
      expect({
         missingDataType: getColumnType({ ...base, data_type: undefined, udt_name: "varchar" }),
         enumDomain: getColumnType({ ...base, data_type: "ENUM('draft', 'published')", udt_name: undefined, domain_name: "article_state" }),
         enumLiteral: getColumnType({ ...base, data_type: "ENUM('draft', 'published')", udt_name: undefined }),
         domain: getColumnType({ ...base, data_type: "USER-DEFINED", udt_name: undefined, domain_name: "positive_integer" }),
         empty: getColumnType({ ...base, data_type: undefined, udt_name: undefined }),
      }).toMatchInlineSnapshot(`
        {
          "domain": {
            "type": "Udt",
            "udt": "positive_integer",
          },
          "empty": {
            "type": "unknown",
          },
          "enumDomain": {
            "type": "Udt",
            "udt": "article_state",
          },
          "enumLiteral": {
            "type": "Udt",
            "udt": "ENUM('DRAFT', 'PUBLISHED')",
          },
          "missingDataType": {
            "type": "string",
          },
        }
      `);
   });
});
