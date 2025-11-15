export type QueryType = "select" | "mutation" | "destructive";

const MUTATION_KEYWORDS = /^\s*(INSERT|UPDATE|DELETE|MERGE|UPSERT)\s+/i;
const DESTRUCTIVE_KEYWORDS = /^\s*(DROP|TRUNCATE|ALTER)\s+/i;

export function detectQueryType(sql: string): QueryType {
   if (DESTRUCTIVE_KEYWORDS.test(sql)) {
      return "destructive";
   }
   if (MUTATION_KEYWORDS.test(sql)) {
      return "mutation";
   }
   return "select";
}
