export type MergeParams<A, B> = [A] extends [never]
   ? [B] extends [never]
      ? never
      : B
   : [B] extends [never]
     ? A
     : { [K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never };
