import type { SqlLanguage } from "./sql-language.js";

export type SqlFormatterFn = (text: string, options: { language: SqlLanguage; keywordCase: "upper" | "lower" }) => string;

export type RegisterFormatterOptions = { active: false } | { active: true; format: SqlFormatterFn };

let _formatter: SqlFormatterFn | null = null;
let _active = false;

export function registerFormatter(options: RegisterFormatterOptions): void {
   _formatter = options.active ? options.format : null;
   _active = options.active;
}

/** @internal */
export function getFormatter(): SqlFormatterFn | null {
   return _active ? _formatter : null;
}
