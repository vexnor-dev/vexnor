import { Sql } from "../sql-base.js";
import { RowIn } from "../sql-types.js";
import { SqlColumn } from "../sql-column.js";
import { SqlQueryContext } from "../sql-query-context.js";
import { SqlTable } from "../sql-table.js";

export class TableUpdateSet<T extends { Update: RowIn }> extends Sql {
   constructor(
      public readonly cols: Record<string, SqlColumn>,
      public readonly update: T["Update"],
   ) {
      super();
   }

   build(context: SqlQueryContext) {
      let i = 0;
      const { strings, values } = context;
      for (const [key, col] of Object.entries(this.cols)) {
         if (!Object.hasOwn(this.update, key)) continue;

         if (i++ > 0) strings.push(", ");
         col.build(context);
         strings.push(" = ?");
         const value = this.update[key as keyof T["Update"]];
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

export function update<T extends { Insert: RowIn; Update: RowIn }>(
   table: SqlTable<T>,
   update: T["Update"],
): TableUpdateSet<T> {
   return new TableUpdateSet<T>(table.$$.cols, update);
}
