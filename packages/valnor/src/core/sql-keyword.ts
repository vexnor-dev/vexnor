import { x } from "../x.js";

export type SqlKeyword =
   | "with"
   | "select"
   | "join"
   | "on"
   | "from"
   | "where"
   | "group by"
   | "having"
   | "using"
   | "order by"
   | "insert into"
   | "replace into"
   | "values"
   | "update"
   | "returning"
   | "set"
   | "delete from"
   | "fn"
   | "create table"
   | "alter table"
   | "drop table"
   | "truncate table"
   | "create index"
   | "drop index"
   | "create view"
   | "drop view"
   | "add constraint"
   | "drop constraint"
   | "create schema"
   | "drop schema"
   | "create type"
   | "drop type"
   | "create function"
   | "drop function"
   | "create trigger"
   | "drop trigger"
   | "as"
   | "in"
   | "exists"
   | "not"
   | "over"
   | "partition by"
   | "merge into"
   | "for"
   | "cast"
   | "case"
   | "when"
   | "then"
   | "else"
   | "end"
   | "between"
   | "and"
   | "or"
   | "like"
   | "ilike"
   | "is"
   | "null"
   | "distinct"
   | "top"
   | "limit"
   | "offset"
   | "union"
   | "union all"
   | "intersect"
   | "except"
   | "minus"
   | "create or replace view"
   | "temporary"
   | "temp"
   | "unique"
   | "add"
   | "drop"
   | "column"
   | "constraint"
   | "primary key"
   | "foreign key"
   | "references"
   | "check"
   | "default"
   | "auto_increment"
   | "identity"
   | "serial"
   | "begin"
   | "commit"
   | "rollback"
   | "savepoint"
   | "lateral"
   | "pivot"
   | "unpivot"
   | "tablesample"
   | "system"
   | "bernoulli"
   | "recursive"
   | "materialized"
   | "refresh"
   | "concurrently"
   | "if not exists"
   | "if exists"
   | "cascade"
   | "restrict"
   | "on conflict"
   | "on duplicate key"
   | "do nothing"
   | "do update"
   | "excluded"
   | "upsert into"
   | "replace"
   | "ignore"
   | "value"
   | "any"
   | "all"
   | "some"
   | "interval"
   | "rows"
   | "range"
   | "unbounded"
   | "preceding"
   | "following"
   | "current"
   | "row"
   | "boolean"
   | "mode";

export const SQL_KEYWORDS: SqlKeyword[] = x(() => {
   const obj: Record<SqlKeyword, null> = {
      select: null,
      "insert into": null,
      update: null,
      "delete from": null,
      join: null,
      from: null,
      fn: null,
      on: null,
      where: null,
      set: null,
      values: null,
      with: null,
      returning: null,
      "group by": null,
      "order by": null,
      having: null,
      "create table": null,
      "alter table": null,
      "drop table": null,
      "create index": null,
      "drop index": null,
      "create view": null,
      "drop view": null,
      "add constraint": null,
      "drop constraint": null,
      "create schema": null,
      "drop schema": null,
      "create type": null,
      "drop type": null,
      "create function": null,
      "drop function": null,
      "create trigger": null,
      "drop trigger": null,
      using: null,
      "replace into": null,
      "truncate table": null,
      as: null,
      in: null,
      exists: null,
      not: null,
      over: null,
      "partition by": null,
      "merge into": null,
      for: null,
      cast: null,
      case: null,
      when: null,
      then: null,
      else: null,
      end: null,
      between: null,
      and: null,
      or: null,
      like: null,
      ilike: null,
      is: null,
      null: null,
      distinct: null,
      top: null,
      limit: null,
      offset: null,
      union: null,
      "union all": null,
      intersect: null,
      except: null,
      minus: null,
      "create or replace view": null,
      temporary: null,
      temp: null,
      unique: null,
      add: null,
      drop: null,
      column: null,
      constraint: null,
      "primary key": null,
      "foreign key": null,
      references: null,
      check: null,
      default: null,
      auto_increment: null,
      identity: null,
      serial: null,
      begin: null,
      commit: null,
      rollback: null,
      savepoint: null,
      lateral: null,
      pivot: null,
      unpivot: null,
      tablesample: null,
      system: null,
      bernoulli: null,
      recursive: null,
      materialized: null,
      refresh: null,
      concurrently: null,
      "if not exists": null,
      "if exists": null,
      cascade: null,
      restrict: null,
      "on conflict": null,
      "on duplicate key": null,
      "do nothing": null,
      "do update": null,
      excluded: null,
      "upsert into": null,
      replace: null,
      ignore: null,
      value: null,
      any: null,
      all: null,
      some: null,
      interval: null,
      rows: null,
      range: null,
      unbounded: null,
      preceding: null,
      following: null,
      current: null,
      row: null,
      boolean: null,
      mode: null,
   };
   return Object.keys(obj) as SqlKeyword[];
});

export function parseSqlKeywords(text: string): SqlKeyword[] {
   const results: SqlKeyword[] = [];
   const tokens = text.toLowerCase().match(/\w+|\S/g) || [];
   let insideParentheses = 0;
   let insideCaseExpression = false;

   for (let i = 0; i < tokens.length; i++) {
      let matched = false;
      const token = tokens[i]!;

      // Track parentheses depth
      if (token === "(") {
         insideParentheses++;
      } else if (token === ")") {
         insideParentheses--;
      }

      // Track case expressions
      if (token === "case") {
         insideCaseExpression = true;
      } else if (token === "end" && insideCaseExpression) {
         insideCaseExpression = false;
      }

      // Try to match multi-word keywords first (longest match wins)
      for (const keyword of SQL_KEYWORDS.filter((k) => k.includes(" ")).sort(
         (a, b) => b.split(" ").length - a.split(" ").length,
      )) {
         const segments = keyword.split(" ");
         if (i + segments.length <= tokens.length && segments.every((seg, idx) => tokens[i + idx] === seg)) {
            results.push(keyword);
            i += segments.length - 1;
            matched = true;
            break;
         }
      }

      if (matched) continue;

      // Skip operators and special characters that aren't keywords
      if (/^[@~:?\-'><=!]/.test(token)) {
         continue;
      }

      // Check for array syntax like array[...] or identifier[...]
      if (i + 1 < tokens.length && tokens[i + 1] === "[") {
         // Only add "fn" if we're not already inside a function call
         const prevToken = i > 0 ? tokens[i - 1] : null;
         if (prevToken !== "(") {
            results.push("fn");
         }
         continue;
      }

      // Check for function calls (any identifier followed by parentheses)
      if (i + 1 < tokens.length && tokens[i + 1] === "(") {
         // Special case: keywords that should always be treated as functions when followed by parentheses
         const isFunctionKeyword = /^(any|exists)$/.test(token);

         if (SQL_KEYWORDS.includes(token as SqlKeyword) && !isFunctionKeyword) {
            // Pattern-based approach: Identify keywords that are NOT function calls
            const isNonFunctionKeyword =
               // Predicates and operators that take expressions in parentheses
               /^(in|exists|not)$/.test(token) ||
               // Window function structural keywords
               /^(over|partition)$/.test(token) ||
               // Table and join structural keywords
               /^(using|values)$/.test(token) ||
               // Data transformation keywords
               /^(pivot|unpivot)$/.test(token) ||
               // Alias keyword when used with expressions
               token === "as";

            if (!isNonFunctionKeyword) {
               results.push(token as SqlKeyword);
            }
         } else {
            // Non-keyword followed by parentheses or function keywords - treat as function
            const lastKeyword = results[results.length - 1];
            const isTableContext =
               lastKeyword === "insert into" ||
               lastKeyword === "create table" ||
               lastKeyword === "alter table" ||
               lastKeyword === "upsert into" ||
               lastKeyword?.includes("table") ||
               lastKeyword?.includes("into");

            // Special case: CTE definitions like "cte(n)" after "with recursive"
            const isCteDefinition =
               results.length >= 2 &&
               (results[results.length - 2] === "with" || results[results.length - 1] === "recursive");

            if (!isTableContext && !isCteDefinition) {
               results.push("fn");
            }
         }
         continue;
      }

      // Check for single-word keywords with context-sensitive filtering
      if (SQL_KEYWORDS.includes(token as SqlKeyword)) {
         // Context-sensitive keyword filtering
         const shouldSkipKeyword =
            // Skip "value" in certain contexts (like JSON or NoSQL syntax)
            (token === "value" &&
               // Skip if previous tokens suggest JSON context
               ((i > 0 && /^(select|,)$/.test(tokens[i - 1]!)) ||
                  // Skip if it appears to be a column reference
                  (i + 1 < tokens.length && tokens[i + 1] === "."))) ||
            // Skip keywords that appear in JSON strings or complex expressions
            (token === "value" && text.includes('"')) ||
            // Skip window function frame keywords when they appear in complex expressions
            (/^(rows|range|unbounded|preceding|following|current|row)$/.test(token) && insideParentheses > 0) ||
            // Skip certain keywords when they appear to be part of function names or complex expressions
            (/^(boolean|mode)$/.test(token) && (i === 0 || !/^(where|and|or)$/.test(tokens[i - 1]!))) ||
            // Skip "any" when followed by parentheses (it's acting like a function)
            (token === "any" && i + 1 < tokens.length && tokens[i + 1] === "(") ||
            // Skip "interval" in time expressions (when preceded by dash)
            (token === "interval" && i > 0 && tokens[i - 1] === "-") ||
            // Skip "between" and "and" when inside parentheses (window function frames)
            (/^(between|and)$/.test(token) && insideParentheses > 0) ||
            // Skip keywords inside case expressions that are string literals
            (insideCaseExpression &&
               /^(exists|not)$/.test(token) &&
               i + 1 < tokens.length &&
               tokens[i + 1] !== "(" &&
               // Check if we're in a string literal context (after 'then' or 'else')
               results.length > 0 &&
               /^(then|else)$/.test(results[results.length - 1]!));

         if (!shouldSkipKeyword) {
            results.push(token as SqlKeyword);
         }
      }
   }

   return results;
}
