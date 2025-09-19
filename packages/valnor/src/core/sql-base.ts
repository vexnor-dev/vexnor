import { SqlQueryContext } from "./sql-query-context.js";
import { x } from "../x.js";
import { SqlFormatProvider } from "./sql-format-provider.js";

export type SqlBuildOptions = {
   onAddString?: (text: string) => string;
   formatProvider?: SqlFormatProvider;
};

export type SqlOptions = {
   wrap?: boolean;
};

export abstract class Sql {
   readonly wrap: boolean | undefined;

   protected constructor(options?: SqlOptions) {
      this.wrap = x(() => {
         if (options?.wrap === undefined) return true;

         return options.wrap;
      });
   }

   /**
    * Build the Sql token using the context and options
    * @param context
    * @param options
    */
   abstract build(context: SqlQueryContext, options?: SqlBuildOptions): void;
}
