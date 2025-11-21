import { defineQueryConfig } from "valnor/config";
import { findEnums } from "./find-enums.js";
import { valnorPostgres } from "../valnor-postgres.js";
import { findTables } from "./find-tables.js";

export default defineQueryConfig({ findEnums, findTables })({
   queries: {
      findEnums: {
         plugin: valnorPostgres,
         profile: "default",
         params: {
            schemas: ["valnor_test"],
         },
         limit: 1000,
         format: "table",
      },
      findTables: {
         plugin: valnorPostgres,
         profile: "default",
         params: {
            schemas: ["valnor_test"],
         },
         limit: 10,
         format: "json",
      },
   },
});
