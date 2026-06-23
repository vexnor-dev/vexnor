import { SqlParamValidation } from "#/core/query/params/sql-param-validation.js";
import { SqlBuildError } from "#/core/sql-build-error.js";
import { ok } from "#/lib/assert.js";
import { validateParamObject } from "#/core/query/params/validate-param-object.js";

/**
 * Validates a param value against the given validation rules.
 * Returns an empty array when valid, or an array of all failure messages when invalid.
 */
export function validateParamValue<T>(value: unknown, rules: SqlParamValidation<T> | null): string[] {
   if (!rules) return [];
   if (value == null) return [];
   const errors: string[] = [];

   if (rules.minLength != null) {
      const len = getLength(value);
      if (len == null || len < rules.minLength) errors.push(`expected length >= ${rules.minLength}`);
   }

   if (rules.maxLength != null) {
      const len = getLength(value);
      if (len == null || len > rules.maxLength) errors.push(`expected length <= ${rules.maxLength}`);
   }

   if (rules.pattern) {
      if (typeof value !== "string" || !rules.pattern.test(value)) errors.push(`pattern mismatch`);
   }

   if (rules.min != null) {
      if (!isAtLeast(value, rules.min)) errors.push(`expected value >= ${String(rules.min)}`);
   }

   if (rules.max != null) {
      if (!isAtMost(value, rules.max)) errors.push(`expected value <= ${String(rules.max)}`);
   }

   if (rules.values && !rules.values.some((item) => Object.is(item, value))) {
      errors.push(`value not in enum`);
   }

   if (!rules.obj) {
      return errors;
   }

   if (typeof value !== "object") {
      errors.push(`value is expected to be an object because it has object validation rules`);
      return errors;
   }

   validateParamObject(value as Record<string, unknown>, rules.obj, errors);

   return errors;
}

function getLength(value: unknown): number | null {
   if (typeof value === "string") return value.length;
   if (Array.isArray(value)) return value.length;
   throw new SqlBuildError(`value is not a string or array`, {
      code: "PARAM_VALIDATION_FAILED",
   });
}

function isAtLeast(value: unknown, min: unknown): boolean {
   switch (typeof min) {
      case "number":
         ok(typeof value === "number" && !isNaN(value), `value=${value} is not a number`);
         ok(typeof min === "number" && !isNaN(min), `min=${min} is not a number`);
         return value >= min;
      case "string":
         ok(typeof value === "string", `value=${value} is not a string`);
         return value >= min;
      case "object":
         ok(value instanceof Date, `value=${value} is not a Date`);
         ok(min instanceof Date, `min=${min} is not a Date`);
         return value.getTime() >= min.getTime();
      default:
         throw new SqlBuildError(`min=${min} is not a number, string, or Date`, {
            code: "PARAM_VALIDATION_FAILED",
         });
   }
}

function isAtMost(value: unknown, max: unknown): boolean {
   switch (typeof max) {
      case "number":
         ok(typeof value === "number" && !isNaN(value), `value=${value} is not a number`);
         ok(typeof max === "number" && !isNaN(max), `max=${max} is not a number`);
         return value <= max;
      case "string":
         ok(typeof value === "string", `value=${value} is not a string`);
         ok(typeof max === "string", `max=${max} is not a string`);
         return value <= max;
      case "object":
         ok(value instanceof Date, `value=${value} is not a Date`);
         ok(max instanceof Date, `max=${max} is not a Date`);
         return value.getTime() <= max.getTime();
      default:
         throw new SqlBuildError(`max=${max} is not a number, string, or Date`, {
            code: "PARAM_VALIDATION_FAILED",
         });
   }
}
