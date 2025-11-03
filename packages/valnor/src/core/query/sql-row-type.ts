import { Sql } from "../sql-base.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlRowTypeAny = SqlRowType<any>;

// eslint-disable-next-line unused-imports/no-unused-vars
export class SqlRowType<T> extends Sql {
   constructor() {
      super();
   }

   $build(): void {
      // write the row type declaration as sql comments
   }
}

export function rowType<T>() {
   return new SqlRowType<T>();
}
