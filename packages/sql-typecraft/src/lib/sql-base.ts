import { SqlQueryContext } from "./sql-query-context.js";

export type SqlBuildOptions = {
   onAddString?: (text: string) => string;
};

export abstract class Sql {
   abstract build(context: SqlQueryContext, options?: SqlBuildOptions): void;
}
