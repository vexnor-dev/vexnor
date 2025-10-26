import { Sql } from "../sql-base.js";
import { RowIn } from "../sql-types.js";
import { SqlColumn } from "../schema/index.js";
import { SqlQueryContext } from "../query/index.js";
import { SqlBuildError } from "../sql-build-error.js";

export class TableUpdateSet<T extends { Update: RowIn }> extends Sql {
   constructor(
      public readonly columns: Record<keyof T["Update"], SqlColumn>,
      public readonly update: T["Update"],
   ) {
      super();
   }

   $build(context: SqlQueryContext) {
      let i = 0;
      const { strings, values } = context;
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

         if (i++ > 0) strings.push(", ");
         col.$build(context);
         strings.push(" = ?");
         const value = this.update[key];
         switch (typeof value) {
            case "object":
               if (value === null || value instanceof Date) {
                  values.push(value);
                  break;
               }

               throw TypeError(`Update value for ${key} is an object: ${value}`);
            case "function":
               throw TypeError(`Update value for ${key} is a function: ${value}`);
            default:
               values.push(value);
               break;
         }
      }
   }
}
