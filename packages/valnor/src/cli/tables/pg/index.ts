import * as writeTable from "./write-table.js";
import * as writeTableType from "./write-table-type.js";

export const pg = {
   ...writeTable,
   ...writeTableType,
};
