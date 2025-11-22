import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "../query/index.js";
import { ok } from "assert";
import { InferTable$RowBySelect } from "../types/index.js";
import { getCanonicalInsertKeys } from "../utils/index.js";

export class TableInsertCols<
   T extends {
      Insert: Partial<T["Select"]>;
      Select: Record<string, unknown>;
   },
> extends Sql {
   private readonly keys: string[];

   constructor(
      public readonly row: InferTable$RowBySelect<T["Select"]>,
      private readonly inserts: T["Insert"][],
   ) {
      super({
         ID: `${Object.values(row)
            .map((c) => c.ID)
            .join(", ")} | rows: ${inserts.length}`,
      });
      this.keys = getCanonicalInsertKeys(row, inserts);
   }

   build(context: SqlBuildContext) {
      context.addStrings("(");
      this.keys.forEach((key, index) => {
         const column = this.row[`$${key}`];
         ok(column, `Column not found by key: ${key}`);
         if (index > 0) context.addStrings(", ");
         column.build(context);
      });
      context.addStrings(")");
   }
}
