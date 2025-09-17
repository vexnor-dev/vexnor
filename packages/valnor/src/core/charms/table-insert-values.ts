import { SqlQueryContext } from "../sql-query-context.js";
import { Sql } from "../sql-base.js";
import { SqlColumn } from "../sql-column.js";
import { RowIn } from "../sql-types.js";
import { SqlTable } from "../sql-table.js";
import { SqlBuildError } from "../sql-build-error.js";

export class TableInsertValues<T extends { Insert: RowIn }> extends Sql {
   constructor(
      public readonly cols: Record<string, SqlColumn>,
      public readonly inserts: T["Insert"][],
   ) {
      super();
      if (!inserts.length) {
         throw new SqlBuildError(`No rows for insert`);
      }

      const keys = Object.keys(inserts[0]!).join(",");
      for (let i = 0; i < inserts.length; i++) {
         const insertKeys = Object.keys(inserts[i]!);
         if (insertKeys.join(",") !== keys) {
            throw new SqlBuildError(`Row ${i} has different columns than the first row`);
         }

         if (i !== 0) continue;

         for (const key of insertKeys) {
            if (!cols[key]) {
               throw new SqlBuildError(`Column ${key} does not exist`);
            }
         }
      }
   }

   build(context: SqlQueryContext) {
      const { strings, values } = context;
      strings.push("(");
      let i = 0;
      const keys = Object.keys(this.inserts[0]!);
      for (const key of keys) {
         if (i++ > 0) {
            strings.push(", ");
         }

         const col = this.cols[key]!;
         col.build(context);
      }
      strings.push(")", " values ");
      for (let i = 0; i < this.inserts.length; i++) {
         const insert = this.inserts[i]!;
         if (i > 0) {
            strings.push(", ");
         }

         strings.push("(");
         let j = 0;
         for (const key of keys) {
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
   return new TableInsertValues<TOptions>(table.$$.cols, inserts);
}
