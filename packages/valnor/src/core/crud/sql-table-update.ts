import { expand, row, SqlQueryAny, SqlQueryExtended } from "../query/index.js";
import { ParamsOfArgs } from "../sql-base.js";
import { SqlTableCommand } from "./sql-table-command.js";
import { sql } from "../sql.js";
import { ok } from "assert";
import { isPrimitive } from "../../lib/index.js";
import { Void } from "../utils/index.js";

export type SqlTableUpdateArgs = {
   where?: SqlQueryAny;
};

export type SqlTableUpdateParameters<T extends { Update: Record<string, unknown> }> = { set: T["Update"] };

export type SqlTableUpdateResult<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
   Args extends SqlTableUpdateArgs,
> = SqlQueryExtended<{
   Params: Void<SqlTableUpdateParameters<T> & ParamsOfArgs<Args>>;
   Row: T["Select"];
}>;

export class SqlTableUpdate<
   T extends { Select: Record<string, unknown>; Update: Record<string, unknown> },
> extends SqlTableCommand<T> {
   update<Args extends SqlTableUpdateArgs>(args: Args): SqlTableUpdateResult<T, Args> {
      const res = sql`
         update ${this.table}
         set ${expand<SqlTableUpdateParameters<T>>((params) => {
            if (!params?.set) return null;

            const setValues: SqlQueryAny[] = [];
            for (const [key, value] of Object.entries(params.set)) {
               const col = this.table.cols[`$${key}`];
               ok(col, `Column not found: ${key}`);
               ok(isPrimitive(value), `Value it's not a primitive: ${value}`);
               setValues.push(sql` ${col} =
               ${value}`);
            }

            return setValues;
         })}
                ${expand<ParamsOfArgs<Args>>((params) => {
                   if (!args.where) return null;
                   if (!params) return null;
                   if (!("where" in params)) return null;
                   if (!params?.where) return null;
                   if (!params.where) return null;

                   const hasPrefix = (() => {
                      if (!params?.where) return false;

                      return args.where.rawStrings[0]?.trim().toLowerCase().includes("where");
                   })();

                   if (hasPrefix) return args.where;

                   return sql`where ${args.where.render("inline")}`;
                })}
         
         returning ${row(this.table.$$)}
      `;

      return res as SqlTableUpdateResult<T, Args>;
   }
}

export type SqlTableUpdateOptional<T> = T extends {
   Select: Record<string, unknown>;
   Update: Record<string, unknown>;
}
   ? SqlTableUpdate<T>
   : unknown;
