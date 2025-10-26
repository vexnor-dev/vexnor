import { SqlQueryContext } from "../query/index.js";
import { Sql } from "../sql-base.js";
import { RowIn, RowOut } from "../sql-types.js";
import { SqlBuildError } from "../sql-build-error.js";
import { SqlColumn } from "../schema/index.js";

export class TableInsertValues<
   T extends {
      Insert: RowIn;
      Select: RowOut;
   },
> extends Sql {
   constructor(
      public readonly columns: Record<keyof T["Select"], SqlColumn>,
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
            if (!columns[key as keyof T["Select"]]) {
               throw new SqlBuildError(`Column ${String(key)} does not exist`);
            }
         }
      }
   }

   $build(context: SqlQueryContext) {
      const { strings, values } = context;
      strings.push("(");
      let i = 0;
      const keys = Object.keys(this.inserts[0]!);
      for (const key of keys) {
         if (i++ > 0) {
            strings.push(", ");
         }

         const col = this.columns[key as keyof T["Select"]]!;
         col.$build(context);
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
