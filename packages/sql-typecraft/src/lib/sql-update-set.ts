import { Sql } from "./sql-base.js";
import { RowIn, SqlBuild } from "./sql-types.js";
import { SqlColumn } from "./sql-column.js";
import { SqlQueryContext } from "./sql-query-context.js";

export class SqlUpdateSet<T extends { Update: RowIn }> extends Sql {
   constructor(
      public readonly cols: Record<string, SqlColumn>,
      public readonly update: T["Update"],
   ) {
      super();
   }

   build(context: SqlQueryContext): SqlBuild {
      const strings: string[] = [];
      const values: unknown[] = [];
      let i = 0;
      for (const [key, col] of Object.entries(this.cols)) {
         if (!Object.hasOwn(this.update, key)) continue;

         if (i++ > 0) strings.push(", ");
         const build = col.build(context);
         strings.push(...build.strings.map((s) => `${s} = ?`));
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

      return {
         strings,
         values,
      };
   }
}
