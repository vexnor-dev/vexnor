import { Sql } from "./sql-base.js";

export type SqlBuildErrorOptions = {
   queryName?: string;
   strings?: string[];
   token?: Sql;
};

export class SqlBuildError extends Error {
   readonly strings: string[] = [];
   readonly token?: Sql;

   constructor(message: string, options?: SqlBuildErrorOptions) {
      super(message + (options?.strings ? "\n" + options.strings.join("") + "..." : ""));
      if (options?.strings) {
         this.strings.push(...options.strings);
      }

      this.token = options?.token;
   }
}
