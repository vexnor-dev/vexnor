import { SqlTableCreate, SqlTableCreateParams, SqlTableCreateResult } from "./sql-table-crud.js";
import { expand, SqlQueryAny } from "../query/index.js";
import { sql } from "../sql.js";
import { SqlTable } from "../schema/index.js";
import { getCanonicalInsertKeys } from "../utils/index.js";
import { ok } from "assert";
import { isPrimitive, Primitive } from "../../lib/index.js";
import { info } from "../charms/index.js";

export class DefaultTableCreate<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }>
   implements SqlTableCreate<T>
{
   constructor(public readonly table: SqlTable<T>) {}

   create<Args extends { from?: SqlQueryAny }>({ from }: Args): SqlTableCreateResult<T, Args> {
      if (from) {
         return sql`
           insert into ${this.table}
           ${from}
           returning ${this.table.$$}
         ` as SqlTableCreateResult<T, Args>;
      }

      const expandColumns = expand<SqlTableCreateParams<T>>(({ inserts }) => {
         const columns = getCanonicalInsertKeys(this.table.cols, inserts).map((key) => {
            const column = this.table.cols[`$${key}`];
            ok(column, `Table column not found by key: ${key}`);
            return column;
         });
         return sql` ${info({ inline: true })} (${columns})`;
      });

      const expandValues = expand<SqlTableCreateParams<T>>(({ inserts }) => {
         const keys = getCanonicalInsertKeys(this.table.cols, inserts);
         return Object.values(inserts).map((insert) => {
            const values = keys.map((key): Primitive => {
               const result = insert[key];
               ok(isPrimitive(result), `Value it's not a primitive: ${result} of ${key}`);
               return result;
            });
            return sql`(${values})`;
         });
      });

      return sql`
         insert into ${this.table}
            ${expandColumns}
         values
         ${expandValues}
        returning ${this.table.$$}
      ` as SqlTableCreateResult<T, Args>;
   }
}
