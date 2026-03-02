import { expand, SqlQueryAny, SqlQueryExtended } from "../query/index.js";
import { SqlTableCommand } from "./sql-table-command.js";
import { ok } from "assert";
import { sql } from "../sql.js";
import { SqlTable } from "../schema/index.js";
import { ParamsOfArgs } from "../sql-base.js";
import { Simplify } from "../utils/index.js";

export type SqlTableDeleteArgs =
   | {
        where: SqlQueryAny;
     }
   | { force: true };

export type SqlTableDeleteResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlTableDeleteArgs,
> = SqlQueryExtended<{
   Params: Simplify<ParamsOfArgs<Args>>;
   Row: T["Select"];
}>;

export class SqlTableDelete<T extends { Select: Record<string, unknown>; Delete: true }> extends SqlTableCommand<T> {
   constructor(table: SqlTable<T>) {
      super(table);
   }

   delete<Args extends SqlTableDeleteArgs>(args: Args): SqlTableDeleteResult<T, Args> {
      if ("where" in args) {
         ok(args.where, "Where clause or force required");
      } else {
         ok(args.force, "Where clause or force required");
      }

      return sql`
         delete
         from ${this.table}
            ${expand<ParamsOfArgs<Args>>((params) => {
               if (!params) return null;
               if (!("where" in args)) return null;
               if (!args.where) return null;
               ok("where" in params, `'params.where' is required.`);

               const hasPrefix = (() => {
                  if (!params?.where) return false;

                  return args.where.rawStrings[0]?.trim().toLowerCase().includes("where");
               })();

               if (hasPrefix) return args.where;

               return sql`where
            ${args.where.render("inline")}`;
            })}
      ` as SqlTableDeleteResult<T, Args>;
   }
}

export type SqlTableDeleteOptional<T> = T extends {
   Select: Record<string, unknown>;
   Delete: true;
}
   ? SqlTableDelete<T>
   : unknown;
