/**
 * Canonical JSON serialization for deterministic hash derivation.
 *
 * MongoDB filter objects don't have guaranteed key ordering. This module
 * produces a canonical JSON string where object keys are sorted alphabetically
 * at every level, ensuring the same logical filter always produces the same hash.
 */

/**
 * Serializes a value to canonical JSON (sorted keys, no whitespace).
 */
export function canonicalJson(value: unknown): string {
   return JSON.stringify(value, canonicalReplacer);
}

function canonicalReplacer(_key: string, value: unknown): unknown {
   if (value === null || value === undefined) return value;
   if (typeof value !== "object") return value;
   if (Array.isArray(value)) return value;

   // Sort object keys for deterministic serialization
   const sorted: Record<string, unknown> = {};
   const keys = Object.keys(value as Record<string, unknown>).sort();
   for (const k of keys) {
      sorted[k] = (value as Record<string, unknown>)[k];
   }
   return sorted;
}
