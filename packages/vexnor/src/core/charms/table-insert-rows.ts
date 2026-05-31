import { InferTable$RowBySelect } from "#/core/types/infer-types.js";
import { Sql } from "#/core/sql-base.js";
import { getCanonicalInsertKeys } from "#/core/utils/canonical-insert-keys.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";

export class TableInsertRows<
   T extends {
      Insert: Partial<T["Select"]>;
      Select: Record<string, unknown>;
   },
> extends Sql {
   private readonly keys: string[];

   constructor(
      public readonly cols: InferTable$RowBySelect<T["Select"]>,
      public readonly inserts: T["Insert"][],
   ) {
      super({
         type: "TableInsertRows",
         id: `rows: ${inserts.length}`,
         hashId: `[${Object.values(cols)
            .map((c) => c.hashId)
            .join(",")}]|${JSON.stringify(inserts)}`,
      });
      this.keys = getCanonicalInsertKeys(cols, inserts);
   }

   write(context: SqlBuildContext) {
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
