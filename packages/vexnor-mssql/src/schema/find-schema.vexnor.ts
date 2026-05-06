import { defineQueryConfig } from "vexnor/config";
import { findTables, findPrimaryKeys } from "#/schema/find-tables.js";
import { vexnorMssql } from "#/vexnor-mssql.js";

export default defineQueryConfig({ findTables, findPrimaryKeys })({
   queries: {
      findTables: {
         plugin: vexnorMssql,
         profile: "mssql",
         params: {
            schemas: ["vexnor_dev"],
         },
         limit: 1,
         format: "json",
      },
      findPrimaryKeys: {
         plugin: vexnorMssql,
         profile: "mssql",
         params: {
            schemas: ["vexnor_dev"],
         },
         limit: 100,
         format: "json",
      },
   },
});
