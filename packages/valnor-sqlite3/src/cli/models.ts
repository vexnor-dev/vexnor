import { newTable } from "valnor/core";

export const SqliteMaster = newTable(
   {
      name: "sqlite_master",
   },
   {
      type: "type",
      name: "name", 
      tbl_name: "tbl_name",
      rootpage: "rootpage",
      sql: "sql",
   },
);

export const PragmaTableInfo = newTable(
   {
      name: "pragma_table_info",
   },
   {
      cid: "cid",
      name: "name",
      type: "type", 
      notnull: "notnull",
      dflt_value: "dflt_value",
      pk: "pk",
   },
);