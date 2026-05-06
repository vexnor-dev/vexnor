export function ok(condition: unknown, message?: string): asserts condition {
   if (!condition) throw new Error(message ?? "Assertion failed");
}

export function strictEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T {
   if (actual !== expected) throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}`);
}
