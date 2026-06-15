import { newSqlTable } from "@vexnor/core";

export const SqliteMaster = newSqlTable<{
   Select: { type: string; name: string; tbl_name: string; rootpage: number; sql: string };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   pk: [],
   tableInfo: {
      name: "sqlite_master",
   },
   columns: {
      type: "type",
      name: "name",
      tbl_name: "tbl_name",
      rootpage: "rootpage",
      sql: "sql",
   },
});

export const PragmaTableInfo = newSqlTable<{
   Select: { cid: number; name: string; type: string; notnull: boolean; dflt_value: string };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   pk: [],
   tableInfo: {
      name: "pragma_table_info",
   },
   columns: {
      cid: "cid",
      name: "name",
      type: "type",
      notnull: "notnull",
      dflt_value: "dflt_value",
   },
});
