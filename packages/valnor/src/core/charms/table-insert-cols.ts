import { InferTable$RowBySelect } from "#/core/types/infer-types.js";
import { Sql } from "#/core/sql-base.js";
import { getCanonicalInsertKeys } from "#/core/utils/canonical-insert-keys.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { ok } from "assert";

export class TableInsertCols<
   T extends {
      Insert: Partial<T["Select"]>;
      Select: Record<string, unknown>;
   },
> extends Sql {
   private readonly keys: string[];

   constructor(
      public readonly cols: InferTable$RowBySelect<T["Select"]>,
      inserts: T["Insert"][],
   ) {
      super({
         id: `${Object.values(cols)
            .map((c) => c.id)
            .join(", ")} | rows: ${inserts.length}`,
      });
      this.keys = getCanonicalInsertKeys(cols, inserts);
   }

   write(context: SqlBuildContext) {
      context.addStrings("(");
      this.keys.forEach((key, index) => {
         const column = this.cols[`$${key}`];
         ok(column, `Column not found by key: ${key}`);
         if (index > 0) context.addStrings(", ");
         column.build(context);
      });
      context.addStrings(")");
   }
}
