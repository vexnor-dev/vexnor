import type { SqlBuildContext } from "#src/core/builder/sql-build-context.js";

export type SqlTableFormat = "tableName" | "schema.tableName" | "schema.tableName AS tableAlias" | "tableAlias";

const SQL_TABLE_FORMATS: Partial<Record<string, SqlTableFormat>> = {
   with: "tableAlias",
   select: "tableAlias",
   from: "schema.tableName AS tableAlias",
   update: "schema.tableName",
   "insert into": "schema.tableName",
   "delete from": "schema.tableName",
   join: "schema.tableName AS tableAlias",
   fn: "tableAlias",
};

const DEFAULT_TABLE_FORMAT: SqlTableFormat = "schema.tableName";

export type SqlColumnFormat =
   | "columnName"
   | "columnAlias"
   | "tableName.columnName"
   | "tableName.columnAlias"
   | "tableName.columnName AS columnAlias"
   | "tableAlias.columnName"
   | "tableAlias.columnName AS columnAlias"
   | "rawAlias.columnName";

export type SqlSelectFormat = SqlColumnFormat | "(sql) AS columnAlias";

// Default formatting rules, moved here to centralize logic.
const SQL_COLUMN_FORMATS: Partial<Record<string, SqlColumnFormat>> = {
   select: "tableAlias.columnName AS columnAlias",
   returning: "tableName.columnName AS columnAlias",
   output: "tableAlias.columnName AS columnAlias",
   fn: "tableAlias.columnName",
   where: "tableAlias.columnName",
   on: "tableAlias.columnName",
   "insert into": "columnName",
   values: "columnName",
   set: "columnName",
   "group by": "tableAlias.columnName",
   "order by": "tableAlias.columnName",
};

const DEFAULT_COLUMN_FORMAT: SqlColumnFormat = "tableAlias.columnName";

export class DefaultFormatter {
   constructor() {}

   /**
    * Gets the column format for the given column and query context
    * @param context
    */
   getColumnFormat(context: Pick<SqlBuildContext, "keyword" | "exprDepth" | "nextText" | "prevText">): SqlColumnFormat {
      if (!context.keyword) {
         return DEFAULT_COLUMN_FORMAT;
      }

      const format = SQL_COLUMN_FORMATS[context.keyword] ?? DEFAULT_COLUMN_FORMAT;

      // Suppress AS alias when inside an expression (parens, functions, operators)
      if (context.exprDepth > 0 && format === "tableAlias.columnName AS columnAlias") {
         return "tableAlias.columnName";
      }

      // Suppress AS alias when look-ahead shows the column is followed by an
      // expression operator (::cast, ||concat) or closing paren — emitting
      // AS alias here would produce invalid SQL.
      if (format === "tableAlias.columnName AS columnAlias" && context.nextText) {
         const trimmed = context.nextText.trimStart();
         if (trimmed.startsWith("::") || trimmed.startsWith("||") || trimmed.startsWith(")")) {
            return "tableAlias.columnName";
         }
      }

      // Suppress AS alias when look-behind shows the column is preceded by an
      // expression operator (||, ::) — the column is part of an expression
      // and the alias should only appear at the end of the full expression.
      if (format === "tableAlias.columnName AS columnAlias" && context.prevText) {
         const trimmed = context.prevText.trimEnd();
         if (trimmed.endsWith("||") || trimmed.endsWith("::")) {
            return "tableAlias.columnName";
         }
      }

      return format;
   }

   /**
    * Gets the table format for the given table and query context
    * @param context
    */
   getTableFormat(context: Pick<SqlBuildContext, "keyword">): SqlTableFormat {
      if (!context.keyword) {
         return DEFAULT_TABLE_FORMAT;
      }
      return SQL_TABLE_FORMATS[context.keyword] ?? DEFAULT_TABLE_FORMAT;
   }
}
