import { SqlBuildOptions } from "@vexnor/core";
import { MssqlTokenizer } from "#src/mssql-tokenizer.js";

export const defaultQueryOptions: SqlBuildOptions = {
   dialect: "transactsql",
   tokenizer: new MssqlTokenizer(),
   paramFormat: ({ index }: { index: number; name?: string }) => `@param_${index}`,
};
