import { SqlBuildContext } from "../query/index.js";
import { Sql } from "../sql-base.js";
import { InferTable$RowBySelect } from "../types/index.js";
import { getCanonicalInsertKeys } from "../utils/index.js";

export class TableInsertValues<
   T extends {
      Select: Record<string, unknown>;
      Insert: Partial<T["Select"]>;
   },
> extends Sql {
   private readonly keys: string[];

   constructor(
      public readonly row: InferTable$RowBySelect<T["Select"]>,
      public readonly inserts: T["Insert"][],
   ) {
      super({
         ID: `${Object.values(row)
            .map((z) => z.ID)
            .join(", ")} | rows: ${inserts.length}`,
      });
      this.keys = getCanonicalInsertKeys(row, inserts);
   }

   build(context: SqlBuildContext) {
      context.addStrings("(");
      this.keys.forEach((key, i) => {
         if (i > 0) context.addStrings(", ");
         this.row[`$${key}`]!.build(context);
      });

      context.addStrings(")", " values ");
      this.inserts.forEach((insert, i) => {
         if (i > 0) context.addStrings(", ");
         context.addStrings("(");
         this.keys.forEach((key, j) => {
            if (j > 0) context.addStrings(", ");
            context.addStrings("?");
            const value = insert[key as keyof T["Insert"]];
            if (value !== undefined) context.addValues(value);
         });
         context.addStrings(")");
      });
   }
}
