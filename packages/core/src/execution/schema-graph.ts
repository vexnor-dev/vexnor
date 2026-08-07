import type { SqlTableAny, SqlTableForeignKey } from "#src/core/schema/sql-table.js";

import type { ColumnInfo, ForeignKey, JoinResult, JoinStep, JoinType, TableInfo } from "./schema-graph-types.js";

interface FkEdge {
   from: string;
   to: string;
   fromCol: string;
   toCol: string;
}

/**
 * Schema introspection and FK-based join path resolution.
 * Accepts a schema object (Record of vexnor SqlTable instances) and provides
 * table discovery, relationship navigation, and AI-friendly formatting.
 *
 * All table identifiers use the "schema.name" format (e.g. "public.payment").
 *
 * @example
 * ```ts
 * import { SchemaGraph } from "@vexnor/core/execution";
 * import { publicSchema } from "./models";
 *
 * const graph = new SchemaGraph(publicSchema);
 * graph.tables();                                    // ["public.actor", "public.address", ...]
 * graph.table("public.payment");                     // { name, schema, columns, pk, fk }
 * graph.joinPath("public.payment", "public.city");   // [{ table, schema, fromCol, toCol }, ...]
 * ```
 */
export class SchemaGraph {
   /** Map from "schema.name" → SqlTable */
   private readonly _tables: Map<string, SqlTableAny> = new Map();
   private _fkGraph: Map<string, FkEdge[]> | null = null;

   constructor(schema: Record<string, unknown>) {
      for (const entity of Object.values(schema)) {
         if (!this.isTable(entity)) continue;
         const t = entity as SqlTableAny;
         if (!t.pk || (t.pk as unknown[]).length === 0) continue;
         const name = t.tableInfo.name;
         if (name.includes("_p20") || name.includes("_p0000")) continue;
         const key = this.qualifyTable(t);
         this._tables.set(key, t);
      }
   }

   /** All table identifiers as "schema.name" (base tables with PKs, excluding partitions). */
   tables(): string[] {
      return [...this._tables.keys()].sort();
   }

   /** Get introspection info for a table. Identifier must be "schema.name". */
   table(id: string): TableInfo | null {
      const t = this._tables.get(id);
      if (!t) return null;

      const columns: ColumnInfo[] = t.colKeys.map((key: string) => {
         const db = t.dbSchema?.[key as keyof typeof t.dbSchema] as { dbType?: string; nullable?: boolean; default?: string } | undefined;
         return {
            name: key,
            type: db?.dbType ?? "unknown",
            ...(db?.nullable ? { nullable: true } : {}),
            ...(db?.default ? { default: db.default } : {}),
         };
      });

      const fk: ForeignKey[] = (t.fk as SqlTableForeignKey[]).map((f) => ({
         column: f.from[0]!,
         targetTable: `${f.to.schema || (t.tableInfo.schema ?? "public")}.${f.to.table}`,
         targetColumn: f.to.columns[0]!,
      }));

      return {
         name: t.tableInfo.name,
         schema: t.tableInfo.schema ?? "public",
         columns,
         pk: t.pk as string[],
         fk,
      };
   }

   /** Resolve the SqlTable instance. Identifier must be "schema.name". */
   resolve(id: string): SqlTableAny | null {
      return this._tables.get(id) ?? null;
   }

   /** BFS shortest FK path between two tables. Identifiers must be "schema.name". */
   joinPath(from: string, to: string): JoinStep[] | null {
      if (from === to) return [];
      const graph = this.getFkGraph();
      if (!graph.has(from) || !graph.has(to)) return null;

      const visited = new Set<string>([from]);
      const queue: { id: string; path: { fromId: string; toId: string; fromCol: string; toCol: string }[] }[] = [{ id: from, path: [] }];

      while (queue.length > 0) {
         const { id, path } = queue.shift()!;
         const edges = graph.get(id) ?? [];
         for (const edge of edges) {
            if (visited.has(edge.to)) continue;
            visited.add(edge.to);
            const newPath = [...path, { fromId: id, toId: edge.to, fromCol: edge.fromCol, toCol: edge.toCol }];
            if (edge.to === to) {
               return newPath.map((p) => {
                  const [fromSchema, fromTable] = this.splitId(p.fromId);
                  const [toSchema, toTable] = this.splitId(p.toId);
                  return {
                     from: { schema: fromSchema, table: fromTable, column: p.fromCol },
                     to: { schema: toSchema, table: toTable, column: p.toCol },
                  };
               });
            }
            queue.push({ id: edge.to, path: newPath });
         }
      }
      return null;
   }

   /**
    * Create a join query from actual SqlTable instances.
    * Returns the composed query, joinBy params, available columns, and table list.
    */
   join(args: { root: SqlTableAny; targets: { table: SqlTableAny; type?: JoinType }[] }): JoinResult | null {
      const { root, targets } = args;
      const rootId = this.qualifyTable(root);
      const rootName = root.tableInfo.name;

      const path: JoinStep[] = [];
      const seenSteps = new Set<string>();
      for (const target of targets) {
         const targetId = this.qualifyTable(target.table);
         const targetPath = this.joinPath(rootId, targetId);
         if (!targetPath) return null;
         for (const step of targetPath) {
            const stepKey = `${step.from.schema}.${step.from.table}.${step.from.column}->${step.to.schema}.${step.to.table}.${step.to.column}`;
            if (seenSteps.has(stepKey)) continue;
            seenSteps.add(stepKey);
            path.push(step);
         }
      }

      // Build join map for Table.join()
      const joinMap: Record<string, SqlTableAny> = {};
      for (const t of targets) {
         joinMap[t.table.tableInfo.name] = t.table;
      }

      // Create the query: root.join(map).select({})
      const query = (root as unknown as { join: (m: Record<string, SqlTableAny>) => { select: (a: Record<string, unknown>) => unknown } })
         .join(joinMap).select({});

      // Build joinBy from the path
      const joinByObj: Record<string, { on: [string, string, string][]; type?: JoinType }> = {};
      for (const step of path) {
         const stepId = `${step.to.schema}.${step.to.table}`;
         const targetDef = targets.find((t) => this.qualifyTable(t.table) === stepId);
         const type = targetDef?.type && targetDef.type !== "inner" ? targetDef.type : undefined;
         joinByObj[step.to.table] = {
            on: [[`${step.from.table}.${step.from.column}`, "=", `${step.to.table}.${step.to.column}`]],
            ...(type ? { type } : {}),
         };
      }

      // Collect columns
      const tableIds = [rootId, ...path.map((s) => `${s.to.schema}.${s.to.table}`)].filter((tableId, index, values) => values.indexOf(tableId) === index);
      const columns: string[] = [];
      for (const tableId of tableIds) {
         const t = this._tables.get(tableId);
         const name = this.splitId(tableId)[1];
         if (t) {
            for (const col of t.colKeys as string[]) {
               columns.push(name === rootName ? col : `${name}.${col}`);
            }
         }
      }

      return { query, joinBy: joinByObj, tables: tableIds, columns };
   }

   /**
    * Resolve tables by string identifiers ("schema.table") and create a join query.
    * Convenience wrapper over join() that resolves table instances internally.
    */
   joinBy(from: string, targets: { table: string; type?: JoinType }[]): JoinResult | null {
      const rootTable = this._tables.get(from);
      if (!rootTable) return null;
      if (!targets.length) return null;

      const resolvedTargets: { table: SqlTableAny; type?: JoinType }[] = [];
      for (const t of targets) {
         const resolved = this._tables.get(t.table);
         if (!resolved) return null;
         resolvedTargets.push({ table: resolved, type: t.type });
      }

      return this.join({ root: rootTable, targets: resolvedTargets });
   }

   /** Format a table's schema as text (for AI prompts). */
   formatTable(id: string): string {
      const info = this.table(id);
      if (!info) return "";
      const cols = info.columns.map((c) => `${c.name}(${c.type})`).join(", ");
      const pk = info.pk.join(", ");
      const fk = info.fk.length
         ? info.fk.map((f) => `${f.column} → ${f.targetTable}.${f.targetColumn}`).join(", ")
         : "none";
      return `Table: ${info.schema}.${info.name}\n  columns: ${cols}\n  pk: ${pk}\n  fk: ${fk}`;
   }

   /** Compact relationship graph string (for AI system prompts). */
   formatRelationships(): string {
      const lines: string[] = [];
      for (const id of this.tables()) {
         const info = this.table(id);
         if (!info || info.fk.length === 0) continue;
         const rels = info.fk.map((f) => `${f.targetTable}(${f.column})`).join(", ");
         lines.push(`${info.schema}.${info.name} → ${rels}`);
      }
      return lines.join("\n");
   }

   /** Full schema overview: "schema.table(cols) pk:... fk:..." per table. */
   formatOverview(): string {
      return this.tables()
         .map((id) => {
            const info = this.table(id);
            if (!info) return id;
            const cols = info.columns.map((c) => c.name).join(", ");
            const pk = info.pk.join(", ");
            const fk = info.fk.length ? info.fk.map((f) => `${f.column}→${f.targetTable}`).join(", ") : "";
            return `${info.schema}.${info.name}(${cols}) pk:${pk}${fk ? ` fk:${fk}` : ""}`;
         })
         .join("\n");
   }

   private qualifyTable(t: SqlTableAny): string {
      return `${t.tableInfo.schema ?? "public"}.${t.tableInfo.name}`;
   }

   private splitId(id: string): [string, string] {
      const dot = id.indexOf(".");
      if (dot === -1) return ["public", id];
      return [id.slice(0, dot), id.slice(dot + 1)];
   }

   private isTable(entity: unknown): entity is SqlTableAny {
      return (
         !!entity &&
         typeof entity === "object" &&
         "tableInfo" in entity &&
         "colKeys" in entity &&
         "pk" in entity
      );
   }

   private getFkGraph(): Map<string, FkEdge[]> {
      if (this._fkGraph) return this._fkGraph;

      const graph = new Map<string, FkEdge[]>();
      for (const [tableId, t] of this._tables) {
         if (!graph.has(tableId)) graph.set(tableId, []);
         const tableSchema = t.tableInfo.schema ?? "public";
         for (const fk of t.fk as SqlTableForeignKey[]) {
            const targetSchema = fk.to.schema || tableSchema;
            const targetId = `${targetSchema}.${fk.to.table}`;
            const edge: FkEdge = { from: tableId, to: targetId, fromCol: fk.from[0]!, toCol: fk.to.columns[0]! };
            graph.get(tableId)!.push(edge);
            // Reverse edge for bidirectional traversal
            if (!graph.has(targetId)) graph.set(targetId, []);
            graph.get(targetId)!.push({ from: targetId, to: tableId, fromCol: fk.to.columns[0]!, toCol: fk.from[0]! });
         }
      }

      this._fkGraph = graph;
      return graph;
   }
}
