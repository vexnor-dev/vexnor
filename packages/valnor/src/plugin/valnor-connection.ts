export class ValnorConnection<T> {
   constructor(
      private readonly underlying: T,
      private readonly closeFn: (connection: T) => Promise<void>,
   ) {}

   get db(): T {
      return this.underlying;
   }

   async close(): Promise<void> {
      await this.closeFn(this.underlying);
   }
}
