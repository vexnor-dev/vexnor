import { SqlQueryContext } from "../sql-query-context.js";
import { Sql } from "../sql-base.js";
import { ok } from "assert";
import { SqlColumn } from "../sql-column.js";
import { RowIn } from "../sql-types.js";
import { SqlTable } from "../sql-table.js";

export class TableInsertValues<T extends { Insert: RowIn }> extends Sql {
   constructor(
      public readonly cols: Record<string, SqlColumn>,
      public readonly inserts: T["Insert"][],
   ) {
      super();
      ok(inserts.length, `No rows for insert`);
   }

   build(context: SqlQueryContext) {
      ok(this.inserts.length, `No rows for insert`);
      const { strings, values } = context;
      strings.push("(");
      let i = 0;
      for (const col of Object.values(this.cols)) {
         if (i++ > 0) {
            strings.push(", ");
         }

         col.build(context);
      }
      strings.push(")", " values ");
      for (let i = 0, insert = this.inserts[0]; i < this.inserts.length && insert; i++, insert = this.inserts[i]) {
         strings.push(i ? ", (" : "(");
         let j = 0;
         for (const [key] of Object.entries(this.cols)) {
            if (j++ > 0) {
               strings.push(", ");
            }

            const value = insert[key as keyof T["Insert"]];
            switch (value) {
               case undefined:
                  strings.push("default");
                  break;
               default:
                  values.push(value);
                  strings.push(`?`);
                  break;
            }
         }

         strings.push(")");
      }
   }
}

export function values<TOptions extends { Insert: RowIn; Update: RowIn }, TTable extends SqlTable<TOptions>>(
   table: TTable,
   inserts: TOptions["Insert"][],
): TableInsertValues<TOptions> {
   return new TableInsertValues<TOptions>(table.$.cols, inserts);
}
