export type ValuesOf<T> = T[keyof T];

export type JsonRow<T> =
   T extends Record<string, unknown> ? { [K in keyof T]: T[K] extends Date ? string : T[K] } : never;
