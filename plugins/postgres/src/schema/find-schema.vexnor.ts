import { defineQueryConfig } from "@vexnor/core/config";
import { findEnums } from "#src/schema/find-enums.js";
import { vexnorPostgres } from "#src/vexnor-postgres.js";
import { findTables, findTableColumns, findPrimaryKeys } from "#src/schema/find-tables.js";

export default defineQueryConfig({ findEnums, findTables, findTableColumns, findPrimaryKeys })({
   queries: {
      findEnums: {
         plugin: vexnorPostgres,
         profile: "postgres",
         params: {
            schemas: ["vexnor_dev"],
         },
         limit: 1000,
         format: "table",
      },
      findTables: {
         plugin: vexnorPostgres,
         profile: "postgres",
         params: {
            schemas: ["vexnor_dev"],
         },
         limit: 1,
         format: "json",
      },
      findTableColumns: {
         plugin: vexnorPostgres,
         profile: "postgres",
         params: {
            schemas: ["vexnor_dev"],
         },
         limit: 100,
         format: "json",
      },
      findPrimaryKeys: {
         plugin: vexnorPostgres,
         profile: "postgres",
         params: {
            schemas: ["vexnor_dev"],
         },
         limit: 100,
         format: "json",
      },
   },
});
