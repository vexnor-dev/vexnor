import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "../query/index.js";
import { RowIn, RowOut } from "../sql-types.js";
import { SqlColumn } from "../schema/index.js";

export class TableInsertCols<
   T extends {
      Insert: RowIn;
      Select: RowOut;
   },
> extends Sql {
   constructor(
      public readonly columns: Record<keyof T["Select"], SqlColumn>,
      private readonly inserts: T["Insert"][],
   ) {
      super();
   }

   $build(context: SqlQueryContext) {
      if (this.inserts.length === 0) {
         return;
      }
      // Get the keys from the first insert object to determine which columns to include.
      const insertKeys = Object.keys(this.inserts[0]!);
      // Map the keys to their actual database column names using the provided schema.
      const columns = insertKeys.map((key) => {
         return this.columns[key as keyof T["Select"]]!.name;
      });
      const sql = `(${columns.map((c) => `"${c}"`).join(", ")})`;
      context.strings.push(sql);
   }
}
