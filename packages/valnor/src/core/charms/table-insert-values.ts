import { SqlBuildContext } from "../query/index.js";
import { Sql } from "../sql-base.js";
import { SqlBuildError } from "../sql-build-error.js";
import { InferTable$RowBySelect } from "../types/index.js";

export class TableInsertValues<
   T extends {
      Select: Record<string, unknown>;
      Insert: Partial<T["Select"]>;
   },
> extends Sql {
   constructor(
      public readonly row: InferTable$RowBySelect<T["Select"]>,
      public readonly inserts: T["Insert"][],
   ) {
      super({
         ID: `${Object.values(row)
            .map((z) => z.ID)
            .join(", ")} | rows: ${inserts.length}`,
      });
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
            if (!row[`$${key}`]) {
               throw new SqlBuildError(`Column ${String(key)} does not exist`);
            }
         }
      }
   }

   build(context: SqlBuildContext) {
      context.addStrings("(");
      let i = 0;
      const keys = Object.keys(this.inserts[0]!);
      for (const key of keys) {
         if (i++ > 0) {
            context.addStrings(", ");
         }

         const column = this.row[`$${key}`]!;
         column.build(context);
      }

      context.addStrings(")", " values ");
      for (let i = 0; i < this.inserts.length; i++) {
         const insert = this.inserts[i]!;
         if (i > 0) {
            context.addStrings(", ");
         }

         context.addStrings("(");
         let j = 0;
         for (const key of keys) {
            if (j++ > 0) {
               context.addStrings(", ");
            }

            const value = insert[key as keyof T["Insert"]];
            switch (value) {
               case undefined:
                  context.addStrings("?");
                  break;
               default:
                  context.addStrings("?");
                  context.addValues(value);
                  break;
            }
         }

         context.addStrings(")");
      }
   }
}
