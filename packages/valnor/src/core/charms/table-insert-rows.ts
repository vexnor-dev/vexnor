import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "../query/index.js";
import { RowIn, RowOut } from "../sql-types.js";
import { SqlColumn } from "../schema/index.js";

export class TableInsertRows<
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
   }

   $build(context: SqlQueryContext) {
      if (this.inserts.length === 0) {
         return;
      }

      // Establish a consistent column order based on the keys of the first insert object.
      // This ensures the values are ordered correctly to match the output of TableInsertCols.
      const insertKeys = Object.keys(this.inserts[0]!);

      const valueRows: string[] = [];
      for (const arg of this.inserts) {
         const values = insertKeys.map((key) => arg[key as keyof T["Insert"]]);
         valueRows.push(`(${values.map(() => "?").join(", ")})`);
         context.values.push(...values);
      }

      const sql = `values ${valueRows.join(", ")}`;
      context.strings.push(sql);
   }
}
