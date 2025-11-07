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
   readonly data: Record<string, unknown> | null;

   constructor(message: string, info?: SqlBuildErrorOptions) {
      super(message + (info?.strings ? "\n" + info.strings.join("") + "..." : ""));
      if (info?.strings) {
         this.strings.push(...info.strings);
      }

      this.token = info?.token;
      this.data = info?.data || null;
   }
}
