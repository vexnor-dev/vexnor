import { SqlQueryAny } from "#/core/query/sql-query.js";
import { SqlParamAny } from "#/core/query/sql-param.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import type { SqlBuildToken, SqlOperatorToken } from "#/core/query/sql-models.js";
import type { SqlLanguage } from "#/format/sql-language.js";
import { createRequire } from "node:module";
import { SqlFilterBy } from "#/core/operators/sql-filter-by.js";
import { SqlProjectBy } from "#/core/operators/sql-project-by.js";
import type {
   QueryDefinition,
   QueryManifest,
   ParamDefinition,
   ParamValidationSchema,
   TemplateNode,
   ColumnSchema,
} from "./query-manifest.js";

const require = createRequire(import.meta.url);
const { version: GENERATOR_VERSION } = require("../../../package.json") as { version: string };

/**
 * Serializes a SqlQuery by building it with params=null and reading the token stream.
 * Static SQL is pre-resolved (with aliases, column formats), operators emit marker tokens.
 */
export async function serializeQuery(
   query: SqlQueryAny,
   name: string,
   dialect: string,
): Promise<QueryDefinition> {
   const context = new SqlBuildContext({ dialect: dialect as SqlLanguage, params: null });
   query.build(context, null, { queryType: "main" });

   const template = tokensToTemplate(context.tokens);
   const params = serializeParams(query);
   const row = serializeRow(query);

   return {
      name,
      location: query.location,
      hash: await query.hash,
      template,
      params,
      row,
      authorization: query.authorization,
   };
}

/**
 * Serializes a full query registry into a manifest.
 */
export async function serializeManifest(
   queries: Array<{ query: SqlQueryAny; name: string; hash: string }>,
   dialect: string,
): Promise<QueryManifest> {
   const result: QueryManifest = {
      version: 1,
      generatorVersion: GENERATOR_VERSION,
      dialect,
      queries: {},
   };

   for (const { query, name, hash } of queries) {
      result.queries[hash] = await serializeQuery(query, name, dialect);
   }

   return result;
}

/**
 * Converts the build context token stream into portable TemplateNode array.
 * Consecutive text tokens are merged.
 */
function tokensToTemplate(tokens: ReadonlyArray<SqlBuildToken>): TemplateNode[] {
   const nodes: TemplateNode[] = [];

   for (const token of tokens) {
      switch (token.type) {
         case "text":
            // Merge consecutive text nodes
            if (nodes.length > 0 && nodes[nodes.length - 1]!.type === "text") {
               (nodes[nodes.length - 1] as { type: "text"; value: string }).value += token.value;
            } else {
               nodes.push({ type: "text", value: token.value });
            }
            break;
         case "param":
            nodes.push({ type: "param", name: token.name });
            break;
         case "value":
            nodes.push({ type: "value", value: token.value });
            break;
         case "operator":
            nodes.push(operatorToNode(token.operator));
            break;
      }
   }

   return nodes;
}

function operatorToNode(op: SqlOperatorToken): TemplateNode {
   switch (op.type) {
      case "set":
         return { type: "set", param: op.param, columns: op.columns };
      case "insert":
         return { type: "insert", param: op.param, columns: op.columns };
      case "insertCols":
         return { type: "insertCols", param: op.param, columns: op.columns };
      case "insertValues":
         return { type: "insertValues", param: op.param, keys: op.keys };
      case "filter":
         return {
            type: "filter",
            param: op.param,
            columns: op.columns,
            ...(op.prefix ? { prefix: op.prefix } : {}),
            ...(op.suffix ? { suffix: op.suffix } : {}),
         };
      case "orderBy":
         return { type: "orderBy", param: op.param, columns: op.columns };
      case "when":
         return {
            type: "when",
            param: op.param,
            ...(op.negate ? { negate: true } : {}),
            onTrue: tokensToTemplate(op.onTrue),
            ...(op.onFalse ? { onFalse: tokensToTemplate(op.onFalse) } : {}),
         };
      case "projection":
         return { type: "projection", param: op.param, columns: op.columns };
      case "pagination":
         return { type: "pagination" };
      case "upsert":
         return { type: "upsert", param: op.param, columns: op.columns, conflictKeys: op.conflictKeys };
      default:
         return { type: "text", value: "" };
   }
}

function serializeParams(query: SqlQueryAny): Record<string, ParamDefinition> {
   const params = query.params as Record<string, SqlParamAny> | null;
   if (!params) return {};

   // Find SqlFilter and SqlProjection nodes in the query for validation metadata
   const validationSchemas = extractValidationSchemas(query);

   const result: Record<string, ParamDefinition> = {};
   for (const [, param] of Object.entries(params)) {
      result[param.name] = {
         name: param.name,
         isContext: param.isContext,
         ...(param.hasDefault ? { optional: true } : {}),
         ...(param.validation?.label ? { label: param.validation.label } : {}),
         ...(param.validation?.description ? { description: param.validation.description } : {}),
         ...(validationSchemas[param.name] ? { validation: validationSchemas[param.name] } : {}),
      };
   }
   return result;
}

const FILTER_OPERATORS = [
   "equal", "not", "greaterThan", "greaterOrEqual", "lowerThan", "lowerOrEqual",
   "between", "in", "notIn", "like", "notLike", "isNull", "isNotNull",
];

const PROJECTION_FUNCTIONS = ["sum", "count", "avg", "min", "max"];

function extractValidationSchemas(query: SqlQueryAny): Record<string, ParamValidationSchema> {
   const schemas: Record<string, ParamValidationSchema> = {};
   const rawValues = query.rawValues;

   for (const value of rawValues) {
      if (value instanceof SqlFilterBy) {
         const columns = Object.keys(value.table.cols).map((k) => k.slice(1));
         schemas[value.paramName] = {
            type: "filter",
            columns,
            operators: FILTER_OPERATORS,
         };
      } else if (value instanceof SqlProjectBy) {
         const columns = Object.keys(value.table.cols).map((k) => k.slice(1));
         schemas[value.paramName] = {
            type: "projection",
            columns,
            functions: PROJECTION_FUNCTIONS,
         };
      }
   }
   return schemas;
}

function serializeRow(query: SqlQueryAny): Record<string, ColumnSchema> | null {
   const schema = query.jsonSchema;
   if (!schema || Object.keys(schema).length === 0) return null;

   const result: Record<string, ColumnSchema> = {};
   for (const [key, type] of Object.entries(schema)) {
      result[key] = { type: String(type) };
   }
   return result;
}
