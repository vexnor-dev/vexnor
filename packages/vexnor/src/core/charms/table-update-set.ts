import { InferTable$RowBySelect } from "#/core/types/infer-types.js";
import { Sql } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { ok } from "#/lib/assert.js";

export class TableUpdateSet<T extends { Update: Record<string, unknown> }> extends Sql {
   constructor(
      public readonly cols: InferTable$RowBySelect<T["Update"]>,
      public readonly update: T["Update"],
   ) {
      super({
         type: "TableUpdateSet",
         id: `${Object.keys(update).join(", ")}`,
         hashId: Object.keys(update)
            .map((k) => `${cols[`$${k}`]?.hashId ?? k}=${JSON.stringify(update[k])}`)
            .join(","),
      });
   }

   write(context: SqlBuildContext) {
      let i = 0;
      for (const key in this.update) {
         const col = this.cols[`$${key}`];
         ok(col, `Column not found: ${key}. Current columns: ${this.cols}`);

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
