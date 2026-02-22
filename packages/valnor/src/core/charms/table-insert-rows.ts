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
         id: `rows: ${inserts.length}`,
      });
      this.keys = getCanonicalInsertKeys(row, inserts);
   }

   build(context: SqlBuildContext) {
      context.addStrings("values ");
      for (let i = 0; i < this.inserts.length; i++) {
         const insert = this.inserts[i]!;
         if (i > 0) context.addStrings(", ");
         const values = this.keys.map((key) => insert[key]);
         context.addStrings("(");
         for (let k = 0; k < values.length; k++) {
            if (k > 0) context.addStrings(", ");
            context.addValues(values[k]);
         }
         context.addStrings(")");
      }
   }
}
