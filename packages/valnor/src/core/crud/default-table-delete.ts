import { SqlTableDelete, SqlTableDeleteResult } from "./sql-table-crud.js";
import { SqlTableAny } from "../schema/index.js";
import { raw, SqlQueryAny } from "../query/index.js";
import { sql } from "../sql.js";
import { ok } from "assert";

export class DefaultTableDelete implements SqlTableDelete {
   constructor(public readonly table: SqlTableAny) {}

   delete<Args extends { where?: SqlQueryAny; force?: true }>({ where, force }: Args): SqlTableDeleteResult<Args> {
      ok(where || force, "Where clause or force required");

      return sql`
         delete
         from ${this.table}
         ${where ?? raw.BLANK}
      ` as SqlTableDeleteResult<Args>;
   }
}
