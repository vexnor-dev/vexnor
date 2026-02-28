import { SqlTableFind, SqlTableFindResult } from "./sql-table-crud.js";
import { raw, SqlQueryAny } from "../query/index.js";
import { sql } from "../sql.js";
import { SqlTable } from "../schema/index.js";

export class DefaultTableFind<T extends { Select: Record<string, unknown> }> implements SqlTableFind<T> {
   constructor(public readonly table: SqlTable<T>) {}

   find<Args extends { where?: SqlQueryAny }>({ where }: Args): SqlTableFindResult<T, Args> {
      return sql`
        select ${this.table.$$}
        from ${this.table}
        ${where ?? raw.BLANK}
      ` as SqlTableFindResult<T, Args>;
   }
}
