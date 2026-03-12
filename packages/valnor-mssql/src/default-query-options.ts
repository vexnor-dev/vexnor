import { SqlBuildOptions } from "valnor";
import { MssqlTokenizer } from "#/mssql-tokenizer.js";

export const defaultQueryOptions: SqlBuildOptions = {
   dialect: "transactsql",
   tokenizer: new MssqlTokenizer(),
   paramFormat: ({ index }: { index: number; name?: string }) => `@param_${index}`,
};
