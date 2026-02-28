import { SqlTableUpdate, SqlTableUpdateParams, SqlTableUpdateResult } from "./sql-table-crud.js";
import { expand, raw, SqlQueryAny } from "../query/index.js";
import { SqlTable } from "../schema/index.js";
import { sql } from "../sql.js";
import { isPrimitive } from "../../lib/index.js";
import { ok } from "assert";

export class DefaultTableUpdate<T extends { Select: Record<string, unknown>; Update: Partial<T["Select"]> }>
   implements SqlTableUpdate<T>
{
   constructor(public readonly table: SqlTable<T>) {}

   update<Args extends { where?: SqlQueryAny }>({ where }: Args): SqlTableUpdateResult<T, Args> {
      return sql`
         update ${this.table}
         set ${expand<SqlTableUpdateParams<T>>(({ value: obj }) => {
            const results: SqlQueryAny[] = [];
            for (const [key, value] of Object.entries(obj)) {
               const col = this.table.cols[`$${key}`];
               ok(col, `Column not found: ${key}`);
               ok(isPrimitive(value), `Value it's not a primitive: ${value}`);
               results.push(sql` ${col} = ${value}`);
            }

            return results;
         })}
                ${where ?? raw.BLANK}
      ` as SqlTableUpdateResult<T, Args>;
   }
}
