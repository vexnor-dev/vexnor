import { row, sql } from "@vexnor/core";
import { PgNamespace } from "#src/schema/models.js";

export const findSchemas = sql`
   SELECT ${row(PgNamespace.$nspname.as("name"))}
   FROM ${PgNamespace}
   ORDER BY ${PgNamespace.$nspname}`;
