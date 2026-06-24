import { ObjectValidationAny } from "#/core/query/params/sql-param-validation.js";
import { Queue } from "#/lib/queue.js";

export function validateParamObject(
   obj: Record<string, unknown>,
   validation: ObjectValidationAny,
   errors: string[],
): void {
   const { fieldNames, operators, aggregates, fieldValues = null } = validation;
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

      if (allowedKeys && !allowedKeys.has(propKey)) errors.push(`Column key '${propKey}' not allowed in: ${allowedKeys}`);
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
