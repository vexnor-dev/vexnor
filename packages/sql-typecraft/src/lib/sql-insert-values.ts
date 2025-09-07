import { SqlQueryContext } from "./sql-query-context.js";
import { Sql } from "./sql-base.js";
import { ok } from "assert";
import { SqlColumn } from "./sql-column.js";
import { RowIn } from "./sql-types.js";

export class SqlInsertValues<T extends { Insert: RowIn }> extends Sql {
   constructor(
      public readonly cols: Record<string, SqlColumn>,
      public readonly inserts: T["Insert"][],
   ) {
      super();
      ok(inserts.length, `No rows for insert`);
   }

   build(context: SqlQueryContext): { strings: string[]; values?: unknown[] } {
      ok(this.inserts.length, `No rows for insert`);
      const strings: string[] = ["("];
      let i = 0;
      for (const col of Object.values(this.cols)) {
         const build = col.build(context);
         if (i++ > 0) {
            strings.push(", ");
         }

         strings.push(...build.strings);
      }
      strings.push(")", " values ");
      const values: unknown[] = [];
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

      return {
         strings,
         values,
      };
   }
}
