import { DefaultFormatter } from "#/core/builder/default-formatter.js";
import { DefaultTokenizer } from "#/core/builder/default-tokenizer.js";
import { SqlLanguage } from "sql-formatter";
import { SqlParamFormat } from "#/core/query/sql-models.js";

/**
 * Options that control how a query is built and formatted.
 *
 * Pass via the `options` field on any execution method or `getSql()`.
 *
 * - `debug` — called with the final `{ text, values }` before execution; useful for logging
 * - `format` — set to `false` to skip SQL pretty-printing (defaults to `true` outside production)
 * - `dialect` — override the SQL dialect used for formatting (inferred from the plugin by default)
 * - `paramFormat` — override how parameter placeholders are rendered (e.g. `$1`, `?`)
 */
export interface SqlBuildOptions {
   formatter?: DefaultFormatter;
   tokenizer?: DefaultTokenizer;
   onAddString?: (text: string) => string;
   debug?: (args: Readonly<Record<string, unknown>>) => void;
   dialect?: SqlLanguage;
   paramFormat?: SqlParamFormat;
   format?: boolean;
}
