import type { JoinType } from "#src/execution/schema-graph-types.js";
import type {
   LocalDataFetchRequest,
   LocalDataJoinResult,
   LocalDataQueryDescriptor,
   LocalDataSession,
} from "#src/schema/local-data-session.js";
import type {
   SchemaCatalogColumn,
   SchemaCatalogEnum,
   SchemaCatalogObject,
   SchemaCatalogPlugin,
   SchemaCatalogPrimaryKey,
   SchemaCatalogRelationship,
   SchemaCatalogWarning,
} from "#src/schema/schema-catalog.js";
import { InvalidLocalQueryParametersError } from "#src/schema/schema-errors.js";

export type LocalDataGetSchemaRequest = {
   table?: string;
};

export type LocalDataSchemaCapabilities = {
   readable: true;
   insertable: false;
   updatable: false;
   deletable: false;
   stableIdentity: boolean;
   automaticJoin: boolean;
};

export type LocalDataSchemaLimitation = "mutations-disabled" | "no-stable-identity" | "no-known-selected-relationship";

export type LocalDataSchemaObjectSummary = {
   id: string;
   schema: string;
   name: string;
   kind: SchemaCatalogObject["kind"];
   mappingName: string;
   capabilities: LocalDataSchemaCapabilities;
   limitations: LocalDataSchemaLimitation[];
   query: LocalDataQueryDescriptor;
};

export type LocalDataSchemaObject = LocalDataSchemaObjectSummary & {
   columns: SchemaCatalogColumn[];
   primaryKey: SchemaCatalogPrimaryKey | null;
   relationships: SchemaCatalogRelationship[];
   enums: SchemaCatalogEnum[];
   warnings: SchemaCatalogWarning[];
};

export type LocalDataSchemaOverview = {
   catalog: {
      formatVersion: number;
      fingerprint: string;
   };
   plugin: SchemaCatalogPlugin;
   warnings: SchemaCatalogWarning[];
   schemas: Array<{
      name: string;
      objects: LocalDataSchemaObjectSummary[];
   }>;
};

export type LocalDataSchemaDetail = {
   catalog: {
      formatVersion: number;
      fingerprint: string;
   };
   plugin: SchemaCatalogPlugin;
   warnings: SchemaCatalogWarning[];
   object: LocalDataSchemaObject;
};

export type LocalDataJoinRequest = {
   root: {
      schema: string;
      table: string;
   };
   targets: Array<{
      schema: string;
      table: string;
      type?: JoinType;
   }>;
};

export type LocalDataFetchResult = {
   data: unknown[];
   rowCount: number;
};

export type LocalDataTools = {
   getSchema(request?: LocalDataGetSchemaRequest): Promise<LocalDataSchemaOverview | LocalDataSchemaDetail>;
   join(request: LocalDataJoinRequest): Promise<LocalDataJoinResult>;
   fetchData(request: LocalDataFetchRequest): Promise<LocalDataFetchResult>;
};

export function createLocalDataTools(session: LocalDataSession): LocalDataTools {
   const joinByDefaults = new Map<string, LocalDataJoinResult["joinBy"]>();

   return {
      async getSchema(request = {}) {
         validateObject(request, "getSchema request", ["table"]);
         if (request.table === undefined) return schemaOverview(session);
         const table = requiredString(request.table, "getSchema table");
         return schemaDetail(session, table);
      },

      async join(request) {
         validateObject(request, "join request", ["root", "targets"]);
         validateObject(request.root, "join root", ["schema", "table"]);
         const root = `${requiredString(request.root.schema, "join root schema")}.${requiredString(request.root.table, "join root table")}`;
         if (!Array.isArray(request.targets) || request.targets.length === 0) {
            throw new InvalidLocalQueryParametersError("Local data join requires at least one target");
         }
         const targets = request.targets.map((target, index) => {
            validateObject(target, `join target ${index}`, ["schema", "table", "type"]);
            const type = target.type;
            if (type !== undefined && !isJoinType(type)) {
               throw new InvalidLocalQueryParametersError(`Unknown local data join type: ${String(type)}`);
            }
            return {
               table: `${requiredString(target.schema, `join target ${index} schema`)}.${requiredString(target.table, `join target ${index} table`)}`,
               ...(type ? { type } : {}),
            };
         });
         const result = await session.registerJoin({ from: root, targets });
         joinByDefaults.set(result.hash, result.joinBy);
         return result;
      },

      async fetchData(request) {
         validateObject(request, "fetchData request", ["plugin", "hash", "params"]);
         const plugin = requiredString(request.plugin, "fetchData plugin");
         const hash = requiredString(request.hash, "fetchData hash");
         validateObject(request.params, "fetchData params");
         const joinBy = joinByDefaults.get(hash);
         const params = joinBy ? { ...request.params, joinBy } : request.params;
         const data = await session.fetchRows({ plugin, hash, params });
         return { data, rowCount: data.length };
      },
   };
}

function schemaOverview(session: LocalDataSession): LocalDataSchemaOverview {
   const selected = selectedObjects(session);
   const queries = readQueriesByObject(session);
   return {
      catalog: catalogIdentity(session),
      plugin: session.catalog.plugin,
      warnings: session.catalog.warnings,
      schemas: [...new Set(selected.map((object) => object.schema))].sort().map((name) => ({
         name,
         objects: selected
            .filter((object) => object.schema === name)
            .map((object) => schemaSummary(object, queries, selected)),
      })),
   };
}

function schemaDetail(session: LocalDataSession, table: string): LocalDataSchemaDetail {
   const selected = selectedObjects(session);
   const object = selected.find((candidate) => candidate.id === table);
   if (!object) throw new InvalidLocalQueryParametersError(`Unknown selected schema object: ${table}`);
   const relationships = selectedRelationships(object.id, selected);
   const summary = schemaSummary(object, readQueriesByObject(session), selected);
   return {
      catalog: catalogIdentity(session),
      plugin: session.catalog.plugin,
      warnings: session.catalog.warnings,
      object: {
         ...summary,
         columns: object.columns,
         primaryKey: object.primaryKey,
         relationships,
         enums: session.catalog.enums.filter((entry) => entry.schema === object.schema),
         warnings: object.warnings,
      },
   };
}

function schemaSummary(
   object: SchemaCatalogObject,
   queries: Map<string, LocalDataQueryDescriptor>,
   selected: SchemaCatalogObject[],
): LocalDataSchemaObjectSummary {
   const query = queries.get(object.id);
   if (!query)
      throw new InvalidLocalQueryParametersError(`Missing local read query for selected schema object: ${object.id}`);
   const automaticJoin = selectedRelationships(object.id, selected).length > 0;
   const capabilities: LocalDataSchemaCapabilities = {
      readable: true,
      insertable: false,
      updatable: false,
      deletable: false,
      stableIdentity: object.capabilities.stableIdentity,
      automaticJoin,
   };
   return {
      id: object.id,
      schema: object.schema,
      name: object.name,
      kind: object.kind,
      mappingName: object.mappingName,
      capabilities,
      limitations: limitations(capabilities),
      query,
   };
}

function selectedObjects(session: LocalDataSession): SchemaCatalogObject[] {
   const selectedIds = new Set(session.mappings.mappings.map((mapping) => mapping.id));
   return session.catalog.objects.filter((object) => selectedIds.has(object.id));
}

function readQueriesByObject(session: LocalDataSession): Map<string, LocalDataQueryDescriptor> {
   return new Map(
      session.queries
         .filter((query) => query.kind === "read" && query.objectIds.length === 1)
         .map((query) => [query.objectIds[0]!, query]),
   );
}

function selectedRelationships(objectId: string, selected: SchemaCatalogObject[]): SchemaCatalogRelationship[] {
   const selectedIds = new Set(selected.map((object) => object.id));
   return selected
      .flatMap((object) => object.relationships)
      .filter(
         (relationship) =>
            selectedIds.has(relationship.toObject) &&
            (relationship.fromObject === objectId || relationship.toObject === objectId),
      );
}

function limitations(capabilities: LocalDataSchemaCapabilities): LocalDataSchemaLimitation[] {
   const result: LocalDataSchemaLimitation[] = ["mutations-disabled"];
   if (!capabilities.stableIdentity) result.push("no-stable-identity");
   if (!capabilities.automaticJoin) result.push("no-known-selected-relationship");
   return result;
}

function catalogIdentity(session: LocalDataSession): LocalDataSchemaOverview["catalog"] {
   return {
      formatVersion: session.catalog.formatVersion,
      fingerprint: session.catalog.fingerprint,
   };
}

function requiredString(value: unknown, label: string): string {
   if (typeof value !== "string" || !value.trim()) {
      throw new InvalidLocalQueryParametersError(`${label} must be a non-empty string`);
   }
   return value.trim();
}

function validateObject(
   value: unknown,
   label: string,
   allowedKeys?: string[],
): asserts value is Record<string, unknown> {
   if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new InvalidLocalQueryParametersError(`${label} must be an object`);
   }
   if (!allowedKeys) return;
   const unknown = Object.keys(value)
      .filter((key) => !allowedKeys.includes(key))
      .sort();
   if (unknown.length > 0) {
      throw new InvalidLocalQueryParametersError(`Unknown ${label} properties: ${unknown.join(", ")}`);
   }
}

function isJoinType(value: unknown): value is JoinType {
   return value === "inner" || value === "left" || value === "right" || value === "full" || value === "cross";
}
