export type QueryType = "select" | "mutation" | "destructive";

const MUTATION_KEYWORDS = /^\s*(?:\/\*.*?\*\/\s*)*(INSERT|UPDATE|DELETE|MERGE|UPSERT)\s+/is;
const DESTRUCTIVE_KEYWORDS = /^\s*(?:\/\*.*?\*\/\s*)*(DROP|TRUNCATE|ALTER)\s+/is;

export function detectQueryType(sql: string): QueryType {
   if (DESTRUCTIVE_KEYWORDS.test(sql)) {
      return "destructive";
   }
   if (MUTATION_KEYWORDS.test(sql)) {
      return "mutation";
   }
   return "select";
}
