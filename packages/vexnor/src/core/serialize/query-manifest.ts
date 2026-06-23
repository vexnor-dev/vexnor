/**
 * Portable query manifest format.
 *
 * This is the output of `vexnor serialize` — a JSON file that another stack
 * (Java, .NET, Go) can consume to build and execute SQL queries without
 * needing the TypeScript runtime.
 *
 * The receiving stack implements:
 * 1. A manifest loader (JSON deserialization)
 * 2. The portable operators (param, when, set, insert, filter, orderBy)
 * 3. A QueryRegistry that resolves queries by hash and executes them
 */

/** Top-level manifest containing all serialized queries. */
export interface QueryManifest {
   /** Manifest schema version. */
   version: 1;
   /** Version of the vexnor package that generated this manifest. */
   generatorVersion: string;
   /** SQL dialect used for pre-resolved SQL text. */
   dialect: string;
   /** Map of query hash → query definition. */
   queries: Record<string, QueryDefinition>;
}

/** A single serialized query. */
export interface QueryDefinition {
   /** Human-readable name (the export variable name). */
   name: string;
   /** Source file location where the query was defined. */
   location: string | null;
   /** Stable SHA-256 hash identifying this query. */
   hash: string;
   /** The query template — a sequence of text and operator nodes. */
   template: TemplateNode[];
   /** Declared parameters with their types/metadata. */
   params: Record<string, ParamDefinition>;
   /** Result row schema for deserialization. */
   row: Record<string, ColumnSchema> | null;
   /** Authorization tags required to execute this query. */
   authorization: string[];
}

/** A node in the query template — either literal SQL text or a portable operator. */
export type TemplateNode =
   | TextNode
   | ParamNode
   | ValueNode
   | WhenNode
   | SetNode
   | InsertNode
   | InsertColsNode
   | InsertValuesNode
   | FilterNode
   | OrderByNode
   | ProjectionNode
   | PaginationNode;

export interface TextNode {
   type: "text";
   value: string;
}

export interface ParamNode {
   type: "param";
   name: string;
   /** True if this param is an array that should be expanded to multiple placeholders. */
   array?: boolean;
}

export interface ValueNode {
   type: "value";
   /** Static inline value (e.g., enum constant). */
   value: unknown;
}

export interface WhenNode {
   type: "when";
   /** Boolean param name to evaluate. */
   param: string;
   /** Template to include when param is truthy. */
   onTrue: TemplateNode[];
   /** Template to include when param is falsy (optional). */
   onFalse?: TemplateNode[];
}

export interface SetNode {
   type: "set";
   /** Param name containing the { col: value } object. */
   param: string;
   /** Map of JS key → quoted SQL column name. */
   columns: Record<string, string>;
}

export interface InsertNode {
   type: "insert";
   /** Param name containing the rows array. */
   param: string;
   /** Map of JS key → quoted SQL column name, in table column order. */
   columns: Record<string, string>;
}

export interface InsertColsNode {
   type: "insertCols";
   /** Param name containing the rows array. */
   param: string;
   /** Map of JS key → quoted SQL column name, in table column order. */
   columns: Record<string, string>;
}

export interface InsertValuesNode {
   type: "insertValues";
   /** Param name containing the rows array. */
   param: string;
   /** Ordered list of JS keys (table column order) for value extraction. */
   keys: string[];
}

export interface FilterNode {
   type: "filter";
   /** Param name containing the { col: value } filter object. */
   param: string;
   /** Map of JS key → quoted SQL column expression (with alias). */
   columns: Record<string, string>;
   /** Optional prefix emitted before content (e.g., "where "). */
   prefix?: string;
   /** Optional suffix emitted after content (e.g., " and"). */
   suffix?: string;
}

export interface OrderByNode {
   type: "orderBy";
   /** Param name for the sort field (column key). */
   param: string;
   /** Map of valid column keys → quoted SQL column expression. */
   columns: Record<string, string>;
}

/** Parameter metadata. */
export interface ParamDefinition {
   /** Parameter name. */
   name: string;
   /** Whether this is a context param (server-injected, never from client). */
   isContext: boolean;
   /** Whether the param value is expected to be an array. */
   array?: boolean;
   /** Whether the param is optional. */
   optional?: boolean;
   /** Human-readable label for the parameter. */
   label?: string;
   /** Description of the parameter's purpose and expected values. */
   description?: string;
   /** Structural validation for complex params (filter, select). */
   validation?: ParamValidationSchema;
}

/** Validation schema for structured params — serialized into the manifest for cross-stack validation. */
export interface ParamValidationSchema {
   /** Param type discriminator. */
   type: "filter" | "projection";
   /** Allowed column keys (camelCase property names). */
   columns: string[];
   /** Allowed operators (for filter params). */
   operators?: string[];
   /** Allowed aggregate functions (for projection params). */
   functions?: string[];
}

/** Column schema for result row deserialization. */
export interface ColumnSchema {
   /** JSON type for deserialization (e.g., "date", "json", "array"). */
   type: string;
}

export interface ProjectionNode {
   type: "projection";
   param: string;
   columns: Record<string, string>;
}

export interface PaginationNode {
   type: "pagination";
}
