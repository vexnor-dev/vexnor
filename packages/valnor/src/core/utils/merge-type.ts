type Default<T> = T extends object ? T : unknown;

export type MergeAll<T> = T extends [infer A, ...infer Rest] ? Merge<A, MergeAll<Rest>> : unknown;

export type Merge<A, B> = Omit<Default<A>, keyof Default<B>> & Omit<Default<B>, keyof Default<A>>;

export type Simplify<T> = {
   [K in keyof T as Exclude<T[K], void> extends never ? never : K]: T[K];
};

export type Void<T> = keyof T extends never ? void : { [K in keyof T]: T[K] };
