type Default<T> = T extends object ? T : unknown;

export type Merge<A, B> = Omit<Default<A>, keyof Default<B>> &
   Omit<Default<B>, keyof Default<A>> &
   (Default<A> | Default<B>);

export type MergeAll<T> = T extends [infer A, ...infer Rest] ? Merge<A, MergeAll<Rest>> : unknown;
