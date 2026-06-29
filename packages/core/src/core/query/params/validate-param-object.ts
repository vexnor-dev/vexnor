import { ObjectValidationAny } from "#src/core/query/params/sql-param-validation.js";
import { Queue } from "#src/lib/queue.js";

export function validateParamObject(
   obj: Record<string, unknown>,
   validation: ObjectValidationAny,
   errors: string[],
): void {
   // Arrays are valid for projection params (select) — validate entries, not indices
   if (Array.isArray(obj)) {
      const { fieldNames, aggregates } = validation;
      const allowedKeys = fieldNames ? new Set([...fieldNames, ...aggregates ?? []]) : null;
      for (const entry of obj) {
         if (typeof entry === "string") {
            if (allowedKeys && !allowedKeys.has(entry)) errors.push(`Column '${entry}' not allowed in: ${allowedKeys}`);
         }
         // Tuple entries like ["count", "*", "alias"] are aggregation — skip key validation
      }
      return;
   }

   const { operators, fieldValues = null, fieldNames, aggregates } = validation;
   const allowedKeys = fieldNames ? new Set([...fieldNames, ...aggregates ?? []]) : null;
   const allowedValues = fieldValues ? new Set([...fieldValues, ...Object.keys(operators ?? {})]) : null;

   const props = new Queue(Object.entries(obj));

   for (const {
      item: [propKey, propValue],
   } of props.each()) {
      if (propKey === "or" && Array.isArray(propValue)) {
         for (const item of propValue) {
            if (item && typeof item === "object" && !Array.isArray(item)) {
               props.push(...Object.entries(item));
            }
         }
         continue;
      }

      if (allowedKeys && !allowedKeys.has(propKey) && (typeof propValue !== "object" || propValue === null || Array.isArray(propValue))) errors.push(`Column key '${propKey}' not allowed in: ${allowedKeys}`);
      if (allowedValues && !allowedValues.has(propValue)) errors.push(`Column '${propKey}':'${propValue}' value not allowed in: ${allowedValues}`);

      if (operators && Array.isArray(propValue) && propValue.length >= 1) {
         const op = propValue[0];
         const def = operators[op];
         if (!def) {
            errors.push(`invalid operator: ${op}`);
         } else {
            const argCount = propValue.length - 1;
            if (def.args === "variadic") {
               if (argCount < 1) errors.push(`Column '${propKey}:${propValue}' operator '${op}' requires at least 1 argument`);
            } else if (argCount !== def.args) {
               errors.push(`'${propKey}:${propValue}' operator '${op}' expects ${def.args} argument(s), got ${argCount}`);
            }
         }
      }
   }
}
