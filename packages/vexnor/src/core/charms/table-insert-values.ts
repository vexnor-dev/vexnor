import { InferTable$RowBySelect } from "#/core/types/infer-types.js";
import { Sql } from "#/core/sql-base.js";
import { getCanonicalInsertKeys } from "#/core/utils/canonical-insert-keys.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";

export class TableInsertValues<
   T extends {
      Select: Record<string, unknown>;
      Insert: Partial<T["Select"]>;
   },
> extends Sql {
   private readonly keys: string[];

   constructor(
      public readonly cols: InferTable$RowBySelect<T["Select"]>,
      public readonly inserts: T["Insert"][],
   ) {
      super({
         type: "TableInsertValues",
         id: `${Object.values(cols)
            .map((z) => z.id)
            .join(", ")} | rows: ${inserts.length}`,
         hashId:
            Object.values(cols)
               .map((c) => c.hashId)
               .join(",") +
            "|" +
            JSON.stringify(inserts),
      });
      this.keys = getCanonicalInsertKeys(cols, inserts);
   }

   write(context: SqlBuildContext) {
      context.addStrings("(");
      this.keys.forEach((key, i) => {
         if (i > 0) context.addStrings(", ");
         this.cols[`$${key}`]!.build(context);
      });

      context.addStrings(")", " values ");
      this.inserts.forEach((insert, i) => {
         if (i > 0) context.addStrings(", ");
         context.addStrings("(");
         this.keys.forEach((key, j) => {
            if (j > 0) context.addStrings(", ");
            const value = insert[key as keyof T["Insert"]];
            if (value !== undefined) context.addValues(value);
         });
         context.addStrings(")");
      });
   }
}
