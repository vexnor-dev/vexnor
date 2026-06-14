export class SqlExecError extends Error {
   constructor(message: string) {
      super(message);
      this.name = "SqlExecError";
   }
}
