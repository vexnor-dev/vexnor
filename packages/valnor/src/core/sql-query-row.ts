import { ok } from "assert";
import { SqlColumn } from "./sql-column.js";
import { SqlRaw } from "./sql-raw.js";

export class SqlQueryRow {
   private readonly name: string;

   constructor({ name }: { name: string }) {
      this.name = name;
   }

   get $() {
      return {
         name: new SqlRaw(this.name),
      };
   }

   get $$all() {
      return new SqlColumn({
         name: "*",
         table: {
            name: this.name,
            alias: this.name,
         },
      });
   }

   static proxyHandler: ProxyHandler<SqlQueryRow> = {
      getPrototypeOf(target) {
         ok(typeof target.constructor.prototype === "object", "prototype is not an instance");

         return target.constructor.prototype;
      },
      get(target, prop) {
         switch (prop) {
            case "toString":
               return target.toString.bind(target);
            case "$":
               return target.$;
            case "$$all":
               return target.$$all;
            default:
               return new SqlColumn({
                  name: prop.toString(),
                  table: {
                     name: target.name,
                     alias: target.name,
                  },
               });
         }
      },
   };
}
