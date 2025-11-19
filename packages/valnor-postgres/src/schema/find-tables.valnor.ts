import { defineQueryConfig } from "valnor/config";
import { valnorPostgres } from "../valnor-postgres.js";
import { findTables } from "./find-tables.js";

export default defineQueryConfig({ findTables })({
   queries: {
      findTables: {
         plugin: valnorPostgres,
         profile: "default",
         params: {
            schemas: ["valnor_test"],
         },
         limit: 1000,
         format: "json",
      },
   },
});
