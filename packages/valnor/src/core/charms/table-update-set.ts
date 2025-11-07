import { Sql } from "../sql-base.js";
import { SqlQueryContext } from "../query/index.js";
import { SqlBuildError } from "../sql-build-error.js";
import { InferTableColumnsByRecord } from "../types/index.js";

export class TableUpdateSet<T extends { Update: Record<string, unknown> }> extends Sql {
   constructor(
      public readonly columns: InferTableColumnsByRecord<T["Update"]>,
      public readonly update: T["Update"],
   ) {
      super();
   }

   build(context: SqlQueryContext) {
      let i = 0;
      for (const key in this.update) {
         const col = this.columns[key];
         if (!col) {
            throw new SqlBuildError(`Column not found: ${key}`, {
               data: {
                  key,
                  columns: this.columns,
               },
            });
         }

         if (i++ > 0) context.addStrings(", ");
         col.build(context);
         context.addStrings(" = ?");
         const value = this.update[key];
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
