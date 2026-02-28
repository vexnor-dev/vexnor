import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "../query/index.js";
import { SqlBuildError } from "../sql-build-error.js";
import { InferTable$RowBySelect } from "../types/index.js";

export class TableUpdateSet<T extends { Update: Record<string, unknown> }> extends Sql {
   constructor(
      public readonly cols: InferTable$RowBySelect<T["Update"]>,
      public readonly update: T["Update"],
   ) {
      super({
         id: `${Object.keys(update).join(", ")}`,
      });
   }

   build(context: SqlBuildContext) {
      let i = 0;
      for (const key in this.update) {
         const col = this.cols[`$${key}`];
         if (!col) {
            throw new SqlBuildError(`Column not found: ${key}`, {
               data: {
                  key,
                  columns: this.cols,
               },
            });
         }

         if (i++ > 0) context.addStrings(", ");
         col.build(context);
         const value = this.update[key];
         context.addStrings(" = ");
         switch (typeof value) {
            case "object":
               if (value === null || value instanceof Date) {
                  context.addValues(value);
                  break;
               }

               throw TypeError(`Update value for ${key} is an object: ${value}`);
            case "function":
               throw TypeError(`Update value for ${key} is a function: ${value}`);
            default:
               context.addValues(value);
               break;
         }
      }
   }
}
