import { defineQueryConfig } from "valnor/config";
import { findEnums } from "#/schema/find-enums.js";
import { valnorPostgres } from "#/valnor-postgres.js";
import { findTables, findTableColumns, findPrimaryKeys } from "#/schema/find-tables.js";

export default defineQueryConfig({ findEnums, findTables, findTableColumns, findPrimaryKeys })({
   queries: {
      findEnums: {
         plugin: valnorPostgres,
         profile: "postgres",
         params: {
            schemas: ["valnor_test"],
         },
         limit: 1000,
         format: "table",
      },
      findTables: {
         plugin: valnorPostgres,
         profile: "postgres",
         params: {
            schemas: ["valnor_test"],
         },
         limit: 1,
         format: "json",
      },
      findTableColumns: {
         plugin: valnorPostgres,
         profile: "postgres",
         params: {
            schemas: ["valnor_test"],
         },
         limit: 100,
         format: "json",
      },
      findPrimaryKeys: {
         plugin: valnorPostgres,
         profile: "postgres",
         params: {
            schemas: ["valnor_test"],
         },
         limit: 100,
         format: "json",
      },
   },
});
