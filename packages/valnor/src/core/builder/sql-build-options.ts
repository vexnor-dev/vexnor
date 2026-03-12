import { DefaultFormatter } from "#/core/builder/default-formatter.js";
import { DefaultTokenizer } from "#/core/builder/default-tokenizer.js";
import { SqlLanguage } from "sql-formatter";
import { SqlParamFormat } from "#/core/query/sql-models.js";

export interface SqlBuildOptions {
   formatter?: DefaultFormatter;
   tokenizer?: DefaultTokenizer;
   onAddString?: (text: string) => string;
   debug?: (args: Readonly<Record<string, unknown>>) => void;
   dialect?: SqlLanguage;
   paramFormat?: SqlParamFormat;
   format?: boolean;
}
