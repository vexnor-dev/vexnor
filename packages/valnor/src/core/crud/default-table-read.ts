import { SqlTableRead, SqlTableReadResult } from "./sql-table-crud.js";
import { raw, SqlQueryAny } from "../query/index.js";
import { sql } from "../sql.js";
import { SqlTable } from "../schema/index.js";

export class DefaultTableRead<T extends { Select: Record<string, unknown> }> implements SqlTableRead<T> {
   constructor(public readonly table: SqlTable<T>) {}

   read<Args extends { where?: SqlQueryAny }>({ where }: Args): SqlTableReadResult<T, Args> {
      return sql`
        select ${this.table.$$}
        from ${this.table}
        ${where ?? raw.BLANK}
      ` as SqlTableReadResult<T, Args>;
   }
}
