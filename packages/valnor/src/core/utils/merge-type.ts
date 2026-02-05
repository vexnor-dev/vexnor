export type Merge<A, B> =
   A extends Record<string, unknown>
      ? B extends Record<string, unknown>
         ? {
              [K in keyof A | keyof B]: K extends keyof (A | B)
                 ? A[K] | B[K]
                 : K extends keyof B
                   ? B[K]
                   : K extends keyof A
                     ? A[K]
                     : never;
           }
         : A
      : B extends Record<string, unknown>
        ? B
        : never;

export type MergeAll<T> = T extends [infer First, ...infer Rest]
   ? First extends Record<string, unknown>
      ? Merge<First, MergeAll<Rest>>
      : MergeAll<Rest>
   : unknown;
