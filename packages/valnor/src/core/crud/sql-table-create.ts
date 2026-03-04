import { expand, row, SqlQueryAny, SqlQueryExtended } from "../query/index.js";
import { getCanonicalInsertKeys, Void } from "../utils/index.js";
import { SqlTableCommand } from "./sql-table-command.js";
import { sql } from "../sql.js";
import { ok } from "assert";
import { info } from "../charms/index.js";
import { isPrimitive, Primitive } from "../../lib/index.js";
import { ParamsOfArgs } from "../sql-base.js";

export type SqlTableCreateArgs = {
   from?: SqlQueryAny;
};

export type SqlTableCreateParams<T extends { Insert: Record<string, unknown> }> = {
   inserts: T["Insert"][];
};

export type SqlTableCreateResult<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
   Args extends SqlTableCreateArgs,
> = Args extends { from: SqlQueryAny }
   ? SqlQueryExtended<{
        Params: Void<ParamsOfArgs<Args>>;
        Row: T["Select"];
     }>
   : SqlQueryExtended<{
        Params: SqlTableCreateParams<T>;
        Row: T["Select"];
     }>;

export class SqlTableCreate<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
> extends SqlTableCommand<T> {
   create<Args extends SqlTableCreateArgs>(args: Args): SqlTableCreateResult<T, Args> {
      const { from } = args;
      if (from) {
         return sql`
           insert into ${this.table}
           ${from}
           returning ${row(this.table.$$)}
         ` as SqlTableCreateResult<T, Args>;
      }

      const expandColumns = expand<SqlTableCreateParams<T>>((params) => {
         const inserts = params?.inserts;
         if (!inserts) return null;
         const columns = getCanonicalInsertKeys(this.table.cols, inserts).map((key) => {
            const column = this.table.cols[`$${key}`];
            ok(column, `Table column not found by key: ${key}`);
            return column;
         });
         return sql` ${info({ inline: true })} (${columns})`;
      });

      const expandValues = expand<SqlTableCreateParams<T>>((params) => {
         const inserts = params?.inserts;
         if (!inserts) return null;
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
         returning
         ${row(this.table.$$)}
      ` as SqlTableCreateResult<T, Args>;
   }
}

export type SqlTableCreateOptional<T> = T extends {
   Select: Record<string, unknown>;
   Insert: Record<string, unknown>;
}
   ? SqlTableCreate<T>
   : unknown;
