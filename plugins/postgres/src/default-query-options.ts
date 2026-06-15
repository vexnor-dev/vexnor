import { SqlBuildOptions } from "@vexnor/core";
import { PostgresTokenizer } from "#/postgres-tokenizer.js";

export const defaultQueryOptions: SqlBuildOptions = {
   dialect: "postgresql",
   tokenizer: new PostgresTokenizer("default"),
   paramFormat: ({ index }: { index: number }) => `$${index + 1}`,
};
