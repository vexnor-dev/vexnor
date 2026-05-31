import { SqlBuildError } from "#/core/sql-build-error.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";

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

export type ParamValidation<T = unknown> = LengthRules<T> &
   PatternRules<T> &
   RangeRules<T> & {
      enum?: readonly NonNullish<T>[];
      validate?: ValidateFn<T>;
   };

type ParamValidationRuntime = {
   minLength?: number;
   maxLength?: number;
   pattern?: RegExp;
   min?: number | Date;
   max?: number | Date;
   enum?: readonly unknown[];
   validate?: (value: unknown) => boolean | string;
};

export function validateParamValue(name: string, value: unknown, validation: ParamValidation<unknown> | null): void {
   if (!validation) return;
   if (value == null) return;
   const rules = validation as ParamValidationRuntime;
   const fail = (msg: string) => new SqlBuildError(msg, { code: SqlErrorCode.PARAM_VALIDATION_FAILED });

   if (rules.minLength != null) {
      const len = getLength(value);
      if (len == null || len < rules.minLength) throw fail(`Invalid param '${name}': expected length >= ${rules.minLength}`);
   }
   if (rules.maxLength != null) {
      const len = getLength(value);
      if (len == null || len > rules.maxLength) throw fail(`Invalid param '${name}': expected length <= ${rules.maxLength}`);
   }
   if (rules.pattern) {
      if (typeof value !== "string" || !rules.pattern.test(value)) throw fail(`Invalid param '${name}': pattern mismatch`);
   }
   if (rules.min != null) {
      if (!isAtLeast(value, rules.min)) throw fail(`Invalid param '${name}': expected value >= ${String(rules.min)}`);
   }
   if (rules.max != null) {
      if (!isAtMost(value, rules.max)) throw fail(`Invalid param '${name}': expected value <= ${String(rules.max)}`);
   }
   if (rules.enum && !rules.enum.some((item) => Object.is(item, value))) {
      throw fail(`Invalid param '${name}': value not in enum`);
   }
   if (rules.validate) {
      const result = rules.validate(value);
      if (result === false) throw fail(`Invalid param '${name}': custom validation failed`);
      if (typeof result === "string" && result.trim()) throw fail(`Invalid param '${name}': ${result}`);
   }
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
