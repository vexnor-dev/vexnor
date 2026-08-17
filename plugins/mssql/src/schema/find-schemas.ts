import { row, sql } from "@vexnor/core";
import { SysSchemas } from "#src/schema/models.js";

export const findSchemas = sql`
   SELECT ${row(SysSchemas.$name)}
   FROM ${SysSchemas}
   ORDER BY ${SysSchemas.$name}`;
