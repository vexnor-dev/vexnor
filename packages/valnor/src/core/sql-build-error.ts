import { Sql } from "./sql-base.js";

export type SqlBuildErrorOptions = Record<string, unknown> & {
   queryName?: string;
   strings?: string[];
   token?: Sql;
   data?: Record<string, unknown>;
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
