export type NonNull<T> = T extends Record<string, unknown> ? { [K in keyof T]-?: NonNull<T[K]> } : Exclude<T, null>;
