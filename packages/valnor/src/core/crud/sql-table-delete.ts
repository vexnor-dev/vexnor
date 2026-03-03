import { expand, SqlQueryAny, SqlQueryExtended } from "../query/index.js";
import { SqlTableCommand } from "./sql-table-command.js";
import { ok } from "assert";
import { sql } from "../sql.js";
import { SqlTable } from "../schema/index.js";
import { ParamsOfArgs } from "../sql-base.js";
import { Void } from "../utils/index.js";

export type SqlTableDeleteArgs =
   | {
        where: SqlQueryAny;
     }
   | { force: true };

export type SqlTableDeleteResult<Args extends SqlTableDeleteArgs> = SqlQueryExtended<{
   Params: Void<ParamsOfArgs<Args>>;
   Row: void;
}>;

export class SqlTableDelete<T extends { Select: Record<string, unknown>; Delete: true }> extends SqlTableCommand<T> {
   constructor(table: SqlTable<T>) {
      super(table);
   }

   delete<Args extends SqlTableDeleteArgs>(args: Args): SqlTableDeleteResult<Args> {
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

               return sql`where ${args.where.render("inline")}`;
            })}
      `;
   }
}

export type SqlTableDeleteOptional<T> = T extends {
   Select: Record<string, unknown>;
   Delete: true;
}
   ? SqlTableDelete<T>
   : unknown;
