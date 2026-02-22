import { Sql } from "./sql-base.js";

export type SqlBuildErrorOptions = Record<string, unknown> & {
   queryName?: Readonly<string>;
   strings?: ReadonlyArray<string>;
   token?: Readonly<Sql>;
   data?: Readonly<Record<string, unknown>>;
};

export class SqlBuildError extends Error {
   readonly strings: string[] = [];
   readonly token?: Readonly<Sql> | null;
   readonly data: Record<string, unknown> | null;

   constructor(message: string, info?: SqlBuildErrorOptions) {
      super(
         message +
            (() => {
               if (!info?.strings) return "";

               return ": " + info.strings.join("");
            })(),
      );
      if (info?.strings) {
         this.strings.push(...info.strings);
      }

      this.token = info?.token ?? null;
      this.data = info?.data || null;
   }
}
