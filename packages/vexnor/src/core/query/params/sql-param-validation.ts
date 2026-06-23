import { ValuesOf } from "#/core/schema/schema-types.js";
import { validateParamValue } from "#/core/query/params/validate-param-value.js";

export type SqlParamValidation<T> = ParamInfo<T> &
   LengthRules &
   PatternRules &
   RangeRules<T> & { obj?: ObjectValidationAny };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlParamValidationAny = SqlParamValidation<any>;

export type OperatorDef = { args: number | "variadic" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ObjectValidationAny = ObjectValidation<any>;

export type ObjectValidation<T> = {
   fieldNames: Extract<keyof T, string>[];
   fieldValues?: ValuesOf<T>[] | null;
   /** Allowed filter operators with arity definitions */
   operators?: Record<string, OperatorDef> | null;
   /** Allowed aggregate functions */
   aggregates?: string[] | null;
};

type NonNullish<T> = Exclude<T, null | undefined>;

type ParamInfo<T> = {
   label?: string;
   description?: string;
   values?: readonly NonNullish<T>[];
   default?: NonNullish<T>;
   /** Allowed column names — keys in the data must be in this list */
};

type LengthRules = { minLength?: number; maxLength?: number };
type PatternRules = { pattern?: RegExp };
type RangeRules<T> = { min?: T; max?: T };

export function isParamValueValid<T>(value: unknown, validation: SqlParamValidation<T> | null): boolean {
   return validateParamValue(value, validation).length === 0;
}
