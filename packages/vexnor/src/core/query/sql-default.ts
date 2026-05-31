import { Sql } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";

export class SqlDefault extends Sql {
   constructor() {
      super({ type: "SqlDefault", id: "DEFAULT" });
   }

   write(context: SqlBuildContext) {
      context.addStrings("DEFAULT");
   }
}

/**
 * SQL `DEFAULT` keyword token — use in INSERT or UPDATE statements to explicitly
 * apply a column's database default value instead of providing a value.
 *
 * @example
 * sql`
 *   INSERT INTO ${Account} ${Account.insertColsVals({ firstName: "John", createdAt: DEFAULT })}
 * `
 */
export const DEFAULT = new SqlDefault();
