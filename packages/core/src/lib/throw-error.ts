export function throwError<T>(err: Error | (() => Error)): T {
   if (err instanceof Error) {
      throw err;
   } else {
      throw err();
   }
}
