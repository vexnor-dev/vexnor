export function indexedArray<T>(value: T[]): IteratorObject<{ item: T; index: number }> {
   return Iterator.from(value).map((item, index) => ({ item, index }));
}

export function indexedObject<T extends Record<string, unknown>>(
   value: T,
): IteratorObject<{ key: Extract<keyof T, string>; value: T[keyof T]; index: number }> {
   const items = Object.entries(value) as [key: Extract<keyof T, string>, value: T[keyof T]][];
   return Iterator.from(items).map(([key, value], index) => ({ key, value, index }));
}
