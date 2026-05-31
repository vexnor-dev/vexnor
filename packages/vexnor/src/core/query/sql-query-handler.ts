import { SqlQuery, SqlQueryExtended } from "#/core/query/sql-query.js";
import { ok } from "#/lib/assert.js";
import { SqlRunArgs, isRemoteClient } from "#/core/query/sql-query-types.js";
import { SqlRunError } from "#/core/sql-run-error.js";
import { deserialize } from "#/core/utils/sql-json-schema.js";
import type { SqlJsonSchema } from "#/core/utils/sql-json-schema.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryHandlerAny = SqlQueryHandler<any>;
export type SqlExecuteMode = "run" | "all";

/**
 * Base query handler for async database operations
 */
export abstract class SqlQueryHandler<
   T extends { Row?: unknown; Params?: unknown; QueryResult: object; Connection: unknown },
> extends SqlQuery<Pick<T, "Params" | "Row">> {
   protected constructor(query: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(query);
   }

   /**
    * Tags this handler with an authorization label.
    *
    * Uses `Object.create` to return a new object of the same concrete handler
    * type with `_authorization` shadowed — necessary because handler subclasses
    * have incompatible constructor signatures and cannot be re-instantiated
    * generically.
    */
   override authorize(tag: string): this {
      const clone = Object.create(this) as this;
      clone._authorization = tag;
      return clone;
   }

   abstract resolveRows(res: T["QueryResult"]): T["Row"][];

   /**
    * Executes the query and returns the raw QueryResult without deserialized rows.
    */
   abstract execute(
      args: SqlRunArgs<Pick<T, "Connection" | "Params">>,
      mode?: SqlExecuteMode,
   ): Promise<T["QueryResult"]>;

   /**
    * Deserializes rows based on local vs remote execution context.
    * Local: only deserializes nested object/array fields (top-level Date fields are already Date instances from the driver).
    * Remote: deserializes all fields including top-level Date strings.
    */
   deserializeRows(rows: T["Row"][], remote: boolean): T["Row"][] {
      const schema = this.jsonSchema;
      if (!Object.keys(schema).length) {
         return rows;
      }

      const filteredSchema: SqlJsonSchema = remote
         ? schema
         : Object.fromEntries(Object.entries(schema).filter(([, v]) => typeof v !== "string"));
      if (!Object.keys(filteredSchema).length) return rows;
      return rows.map((row) => deserialize(row, filteredSchema));
   }

   /**
    * Override in plugin handlers to deserialize rows and recompose into the native result shape.
    */
   abstract deserialize(result: T["QueryResult"], remote: boolean): T["QueryResult"];

   /**
    * Executes the query, deserializes the result, and returns the raw QueryResult with deserialized rows.
    */
   async run(args: SqlRunArgs<Pick<T, "Connection" | "Params">>): Promise<T["QueryResult"]> {
      try {
         const result = await this.execute(args, "run");
         const remote = isRemoteClient(await args.db);
         return this.deserialize(result, remote);
      } catch (err) {
         if (err instanceof SqlRunError) throw err;
         throw new SqlRunError(`Error executing sql query '${this.id}'`, this, { cause: err, queryName: this.info?.label ?? undefined });
      }
   }

   /**
    * Executes the query and returns exactly one row.
    *
    * Throws if the result contains zero rows or more than one row.
    *
    * @param args - Database connection and query parameters.
    */
   async one(args: SqlRunArgs<Pick<T, "Connection" | "Params">>): Promise<T["Row"]> {
      const rows = await this.all(args);
      ok(rows.length === 1, `Expected one row, actual is ${rows.length} rows.`);
      ok(rows[0], `The one row in result is not defined: ${rows[0]}`);
      return rows[0];
   }

   /**
    * Executes the query and returns the first row.
    * Throws if the result contains zero rows.
    * @param args - Database connection and query parameters.
    */
   async first(args: SqlRunArgs<Pick<T, "Connection" | "Params">>): Promise<T["Row"] | undefined> {
      const rows = await this.all(args);
      return rows.length > 0 ? rows[0] : undefined;
   }

   /**
    * Executes the query and returns the first row, or `undefined` if no rows are found.
    *
    * @param args - Database connection and query parameters.
    */
   async any(args: SqlRunArgs<Pick<T, "Connection" | "Params">>): Promise<T["Row"] | undefined> {
      const rows = await this.all(args);
      return rows.length > 0 ? rows[0] : undefined;
   }

   /**
    * Executes the query and returns all rows.
    *
    * @param args - Database connection and query parameters.
    */
   async all(args: SqlRunArgs<Pick<T, "Connection" | "Params">>): Promise<T["Row"][]> {
      try {
         const result = await this.execute(args, "all");
         const remote = isRemoteClient(await args.db);
         return this.resolveRows(this.deserialize(result, remote));
      } catch (err) {
         throw new SqlRunError(`Error executing sql query '${this.id}'`, this, { cause: err, queryName: this.info?.label ?? undefined });
      }
   }
}

export function newSqlQueryHandler<
   T extends { Row?: unknown; Params?: unknown; QueryResult: object; Connection: unknown },
   Handler extends SqlQueryHandler<T>,
>(handler: Handler): Handler & SqlQueryExtended<Pick<T, "Row" | "Params">> {
   return new Proxy(handler, {
      ownKeys(target): ArrayLike<string | symbol> {
         const rowKeys = target.row ? Object.keys(target.row) : [];
         return [...Reflect.ownKeys(target), ...rowKeys];
      },
      getOwnPropertyDescriptor(target, p: string | symbol): PropertyDescriptor | undefined {
         if (Reflect.has(target, p)) return Reflect.getOwnPropertyDescriptor(target, p);
         if (target.row && Reflect.has(target.row, p)) return Reflect.getOwnPropertyDescriptor(target.row, p);

         return undefined;
      },
      has(target, p: string | symbol): boolean {
         if (Reflect.has(target, p)) return true;
         return Boolean(target.row && Reflect.has(target.row, p));
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         if (Reflect.has(target, p)) return Reflect.get(target, p, receiver);
         if (target.row && Reflect.has(target.row, p)) return Reflect.get(target.row, p, receiver);

         return undefined;
      },
   });
}
