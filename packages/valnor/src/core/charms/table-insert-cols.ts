import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "../query/index.js";
import { ok } from "assert";
import { InferTableColumnsByRecord } from "../types/index.js";

export class TableInsertCols<
   T extends {
      Insert: Partial<T["Select"]>;
      Select: Record<string, unknown>;
   },
> extends Sql {
   constructor(
      public readonly columns: InferTableColumnsByRecord<T["Select"]>,
      private readonly inserts: T["Insert"][],
   ) {
      super();
   }

   build(context: SqlBuildContext) {
      if (this.inserts.length === 0) {
         return;
      }

      context.addStrings("(");
      // Map the keys to their actual database column names using the provided schema.
      Object.keys(this.inserts[0]!).forEach((key, index) => {
         const column = this.columns[key];
         ok(column, `Column not found by key: ${key}`);
         if (index > 0) context.addStrings(", ");
         column.build(context);
      });
      context.addStrings(")");
   }
}
