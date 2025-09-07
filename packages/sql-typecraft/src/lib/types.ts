export type JsonRow<T> =
   T extends Record<string, unknown> ? { [K in keyof T]: T[K] extends Date ? string : T[K] } : never;

export function generateRandomName(size = 3): string {
   return Math.random().toString(36).substring(2, 6).padEnd(size, "a");
}
