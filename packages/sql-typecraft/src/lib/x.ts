export function x<T>(value: () => T): T {
   return value();
}
