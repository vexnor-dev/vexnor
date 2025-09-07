import { ok } from "assert";
import { SqlColumn } from "./sql-column.js";

export class SqlQueryRow {
   readonly name: string;

   constructor({ name }: { name: string }) {
      this.name = name;
   }

   get $all() {
      return new SqlColumn({
         name: "*",
         table: this.name,
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
            case "$all":
               return target.$all;
            default:
               return new SqlColumn({
                  name: prop.toString(),
                  table: target.name,
               });
         }
      },
   };
}
