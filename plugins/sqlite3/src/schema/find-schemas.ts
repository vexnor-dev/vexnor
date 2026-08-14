import { row, sql } from "@vexnor/core";
import { PragmaDatabaseList } from "#src/schema/models.js";

export const findSchemas = sql`
   SELECT ${row(PragmaDatabaseList.$name)}
   FROM pragma_database_list AS ${PragmaDatabaseList.render("tableAlias")}
   ORDER BY ${PragmaDatabaseList.$seq}`;
