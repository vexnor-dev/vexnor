export interface ColumnInfo {
   name: string;
   type: string;
   nullable?: boolean;
   default?: string;
}

export interface ForeignKey {
   column: string;
   targetTable: string;
   targetColumn: string;
}

export interface TableInfo {
   name: string;
   schema: string;
   columns: ColumnInfo[];
   pk: string[];
   fk: ForeignKey[];
}

export interface JoinStepRef {
   schema: string;
   table: string;
   column: string;
}

export interface JoinStep {
   from: JoinStepRef;
   to: JoinStepRef;
}

export type JoinType = "inner" | "left" | "right" | "full" | "cross";

export interface JoinByResult {
   joinBy: Record<string, { on: [string, string, string][]; type?: JoinType }>;
   tables: string[];
   columns: string[];
}

export interface JoinResult {
   /** The composed select query (register this in the query registry) */
   query: unknown;
   /** The joinBy param to pass to fetchData or auto-inject */
   joinBy: Record<string, { on: [string, string, string][]; type?: JoinType }>;
   /** Ordered list of table IDs ("schema.table") in the join */
   tables: string[];
   /** All available columns (root cols bare, joined cols as "table.col") */
   columns: string[];
}
