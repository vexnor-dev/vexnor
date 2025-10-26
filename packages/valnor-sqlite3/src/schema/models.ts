import { newSqlTable } from "valnor";

export const SqliteMaster = newSqlTable(
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

export const PragmaTableInfo = newSqlTable(
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
