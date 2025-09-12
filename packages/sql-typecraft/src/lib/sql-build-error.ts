import { Sql } from "./sql-base.js";

export type SqlBuildErrorOptions = {
   strings: string[];
   token: Sql;
};

export class SqlBuildError extends Error {
   readonly strings: string[] = [];
   readonly token: Sql;

   constructor(message: string, options: SqlBuildErrorOptions) {
      super(message + "\n" + options.strings.join("") + "...");
      this.strings = options.strings;
      this.token = options.token;
   }

   // get [Symbol.toStringTag]() {
   //    const tokens = [this.name, ": ", this.message, "\nstrings:", ...this.strings];
   //    return tokens.join("");
   // }
}
