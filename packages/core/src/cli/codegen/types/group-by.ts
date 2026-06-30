export function groupBy<T>(array: T[], keyFn: (item: T) => string | number): Record<string, T[]> {
   return array.reduce(
      (acc, item) => {
         const key = keyFn(item);
         if (!acc[key]) {
            acc[key] = [];
         }
         acc[key].push(item);
         return acc;
      },
      {} as Record<string, T[]>,
   );
}
