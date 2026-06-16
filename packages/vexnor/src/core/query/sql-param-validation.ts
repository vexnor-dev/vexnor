type NonNullish<T> = Exclude<T, null | undefined>;
type ValidateFn<T> = {
   bivarianceHack: (value: T) => boolean | string;
}["bivarianceHack"];

type LengthRules<T> =
   NonNullish<T> extends string | readonly unknown[] ? { minLength?: number; maxLength?: number } : unknown;
type PatternRules<T> = NonNullish<T> extends string ? { pattern?: RegExp } : unknown;
type RangeRules<T> =
   NonNullish<T> extends number
      ? { min?: number; max?: number }
      : NonNullish<T> extends Date
        ? { min?: Date; max?: Date }
        : unknown;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParamValidationAny = ParamValidation<any>;

export type ParamValidation<T = unknown> = LengthRules<T> &
   PatternRules<T> &
   RangeRules<T> & {
      enum?: readonly NonNullish<T>[];
      values?: readonly NonNullish<T>[];
      default?: NonNullish<T>;
      validate?: ValidateFn<T>;
   };

type ParamValidationRuntime = {
   minLength?: number;
   maxLength?: number;
   pattern?: RegExp;
   min?: number | Date;
   max?: number | Date;
   enum?: readonly unknown[];
   values?: readonly unknown[];
   validate?: (value: unknown) => boolean | string;
};

export function isParamValueValid<T>(value: unknown, validation: ParamValidation<T> | null): boolean {
   return validateParamValue(value, validation).length === 0;
}

/**
 * Validates a param value against the given validation rules.
 * Returns an empty array when valid, or an array of all failure messages when invalid.
 */
export function validateParamValue<T>(value: unknown, validation: ParamValidation<T> | null): string[] {
   if (!validation) return [];
   if (value == null) return [];
   const rules = validation as ParamValidationRuntime;
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

   if (rules.enum && !rules.enum.some((item) => Object.is(item, value))) {
      errors.push(`value not in enum`);
   }

   if (rules.values && !rules.values.some((item) => Object.is(item, value))) {
      errors.push(`value not in allowed values`);
   }

   if (rules.validate) {
      const result = rules.validate(value);
      if (result === false) errors.push(`custom validation failed`);
      else if (typeof result === "string" && result.trim()) errors.push(result);
   }

   return errors;
}

function getLength(value: unknown): number | null {
   if (typeof value === "string") return value.length;
   if (Array.isArray(value)) return value.length;
   return null;
}

function isAtLeast(value: unknown, min: number | Date): boolean {
   if (typeof min === "number") return typeof value === "number" && value >= min;
   return value instanceof Date && value.getTime() >= min.getTime();
}

function isAtMost(value: unknown, max: number | Date): boolean {
   if (typeof max === "number") return typeof value === "number" && value <= max;
   return value instanceof Date && value.getTime() <= max.getTime();
}
