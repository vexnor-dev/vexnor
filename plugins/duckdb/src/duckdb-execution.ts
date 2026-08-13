import {
   type DuckDBPreparedStatement,
   type DuckDBValue,
   type DuckDBValueConverter,
   JSDuckDBValueConverter,
   type JS,
} from "@duckdb/node-api";
import { bindDuckDBValue, hasComplexDuckDBValues, toDuckDBValue } from "#src/duckdb-values.js";

type DuckDBChunk = {
   convertRows<TValue>(converter: DuckDBValueConverter<TValue>): (TValue | null)[][];
};

type DuckDBStreamResult = {
   deduplicatedColumnNames(): string[];
   readonly rowsChanged: number;
   readonly statementType: number;
   [Symbol.asyncIterator](): AsyncIterableIterator<DuckDBChunk>;
};

export type DuckDBClient = {
   prepare(text: string): Promise<DuckDBPreparedStatement>;
   stream(text: string, values?: DuckDBValue[]): Promise<DuckDBStreamResult>;
};

export async function executeDuckDBQuery(db: DuckDBClient, text: string, values: unknown[]) {
   const nativeResult = await getNativeResult(db, text, values);
   const names = nativeResult.deduplicatedColumnNames();
   const rows: Record<string, JS>[] = [];
   for await (const chunk of nativeResult) {
      for (const values of chunk.convertRows(JSDuckDBValueConverter)) {
         rows.push(Object.fromEntries(names.map((name, index) => [name, values[index] ?? null])));
      }
   }
   return {
      rows,
      rowsChanged: nativeResult.rowsChanged,
      statementType: nativeResult.statementType,
   };
}

async function getNativeResult(db: DuckDBClient, text: string, values: unknown[]) {
   if (!hasComplexDuckDBValues(values)) {
      return db.stream(text, values.map(toDuckDBValue));
   }

   const statement = await db.prepare(text);
   try {
      for (let index = 0; index < values.length; index++) {
         bindDuckDBValue(statement, index + 1, values[index]);
      }
      return await statement.stream();
   } finally {
      statement.destroySync();
   }
}
