import { SqlBuildOptions } from "@vexnor/core";
import { DuckDBTokenizer } from "#src/duckdb-tokenizer.js";

export const defaultQueryOptions: SqlBuildOptions = {
   dialect: "duckdb",
   tokenizer: new DuckDBTokenizer("default"),
   paramFormat: ({ index }: { index: number }) => `$${index + 1}`,
};
