import { defineQueryConfig } from "valnor/config";
import { findEnums } from "./find-enums.js";
import { valnorPostgres } from "../valnor-postgres.js";

export default defineQueryConfig({ findEnums })({
   queries: {
      findEnums: {
         plugin: valnorPostgres,
         profile: "default",
         params: {
            schemas: ["valnor_test"],
         },
         limit: 1000,
      },
   },
});
