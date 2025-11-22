import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "../query/index.js";
import { InferTable$RowBySelect } from "../types/index.js";
import { getCanonicalInsertKeys } from "../utils/index.js";

export class TableInsertRows<
   T extends {
      Insert: Partial<T["Select"]>;
      Select: Record<string, unknown>;
   },
> extends Sql {
   private readonly keys: string[];

   constructor(
      public readonly row: InferTable$RowBySelect<T["Select"]>,
      public readonly inserts: T["Insert"][],
   ) {
      super({
         ID: `rows: ${inserts.length}`,
      });
      this.keys = getCanonicalInsertKeys(row, inserts);
   }

   build(context: SqlBuildContext) {
      const valueRows: string[] = [];
      for (const insert of this.inserts) {
         const values = this.keys.map((key) => insert[key]);
         valueRows.push(`(${values.map(() => "?").join(", ")})`);
         context.addValues(...values);
      }

      const sql = `values ${valueRows.join(", ")}`;
      context.addStrings(sql);
   }
}
