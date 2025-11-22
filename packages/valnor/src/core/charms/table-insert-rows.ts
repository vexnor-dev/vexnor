import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "../query/index.js";
import { InferTable$RowBySelect } from "../types/index.js";

export class TableInsertRows<
   T extends {
      Insert: Partial<T["Select"]>;
      Select: Record<string, unknown>;
   },
> extends Sql {
   constructor(
      public readonly row: InferTable$RowBySelect<T["Select"]>,
      public readonly inserts: T["Insert"][],
   ) {
      super({
         ID: `rows: ${inserts.length}`,
      });
   }

   build(context: SqlBuildContext) {
      if (this.inserts.length === 0) {
         return;
      }

      // Establish a consistent column order based on the keys of the first insert object.
      // This ensures the values are ordered correctly to match the output of TableInsertCols.
      const insertKeys = Object.keys(this.inserts[0]!);

      const valueRows: string[] = [];
      for (const insert of this.inserts) {
         const values = insertKeys.map((key) => insert[key]);
         valueRows.push(`(${values.map(() => "?").join(", ")})`);
         context.addValues(...values);
      }

      const sql = `values ${valueRows.join(", ")}`;
      context.addStrings(sql);
   }
}
