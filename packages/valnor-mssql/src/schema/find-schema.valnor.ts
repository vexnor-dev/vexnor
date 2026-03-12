import { defineQueryConfig } from "valnor/config";
import { findTables, findPrimaryKeys } from "#/schema/find-tables.js";
import { valnorMssql } from "#/valnor-mssql.js";

export default defineQueryConfig({ findTables, findPrimaryKeys })({
   queries: {
      findTables: {
         plugin: valnorMssql,
         profile: "mssql",
         params: {
            schemas: ["valnor_test"],
         },
         limit: 1,
         format: "json",
      },
      findPrimaryKeys: {
         plugin: valnorMssql,
         profile: "mssql",
         params: {
            schemas: ["valnor_test"],
         },
         limit: 100,
         format: "json",
      },
   },
});
