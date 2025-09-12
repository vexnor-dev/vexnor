import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "../sql-query-context.js";
import { RowOut } from "../sql-types.js";
import { SqlQueryAny } from "../sql-query.js";
import { sql } from "../sql.js";
import { raw } from "../sql-raw.js";

export class SelectJsonAgg extends Sql {
   constructor(public readonly select: SqlQueryAny) {
      super();
   }

   build(context: SqlQueryContext) {
      switch (context.keyword) {
         case "select":
            context.strings.push(`"${this.select.name}_result"`);
            break;
         case "join": {
            const newContext = new SqlQueryContext({ queryName: this.select.name });
            const result = raw(this.select.name + "_result");
            const join = sql<RowOut>`
               select coalesce(jsonb_agg(${this.select.ROW.$$all}), '[]') as "${result}"
               from ${this.select}`;
            join.build(newContext);
            context.strings.push(...newContext.strings);
            context.values.push(...newContext.values);
            break;
         }
         default:
            throw new TypeError(`Cannot use jsonAgg() with SQL keyword: ${context.keyword}`);
      }
   }
}

export function jsonAgg(select: SqlQueryAny) {
   if (!cache.has(select)) {
      const result = new SelectJsonAgg(select);
      cache.set(select, result);
   }

   return cache.get(select)!;
}

const cache = new WeakMap<SqlQueryAny, SelectJsonAgg>();
