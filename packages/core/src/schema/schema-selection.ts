import type { SchemaCatalog, SchemaCatalogObject } from "#src/schema/schema-catalog.js";
import {
   loadLocalSelection,
   resolveLocalSelectionPath,
   saveLocalSelection,
} from "#src/schema/local-selection-store.js";

export const SCHEMA_SELECTION_FORMAT_VERSION = 1 as const;

export type SchemaSelectionObject = {
   id: string;
   kind: SchemaCatalogObject["kind"];
   selected: boolean;
};

export type SchemaSelectionScope = {
   formatVersion: typeof SCHEMA_SELECTION_FORMAT_VERSION;
   catalogFormatVersion: number;
   catalogFingerprint: string;
   objects: SchemaSelectionObject[];
};

export type SchemaSelectionReviewObject = SchemaSelectionObject & {
   schema: string;
   name: string;
   status: "existing" | "new";
};

export type SchemaSelectionReview = {
   schemas: string[];
   objects: SchemaSelectionReviewObject[];
   removedObjects: SchemaSelectionObject[];
   firstRun: boolean;
};

export type InteractiveSchemaSelectionRequest = {
   mode: "interactive";
   review: (review: SchemaSelectionReview) => Promise<{ selected: readonly string[]; confirmRemoved: boolean }>;
};

export type NonInteractiveSchemaSelectionRequest = {
   mode: "non-interactive";
   include?: readonly string[];
   exclude?: readonly string[];
   all?: boolean;
   save?: boolean;
};

export type SchemaSelectionRequest = InteractiveSchemaSelectionRequest | NonInteractiveSchemaSelectionRequest;

export type SchemaSelectionResult = {
   scope: SchemaSelectionScope;
   selectedObjects: SchemaSelectionObject[];
   deselectedObjects: SchemaSelectionObject[];
   newObjects: SchemaSelectionObject[];
   removedObjects: SchemaSelectionObject[];
};

export class SchemaSelectionError extends Error {
   readonly code = "INVALID_SELECTION";

   constructor(message: string) {
      super(message);
      this.name = "SchemaSelectionError";
   }
}

export async function resolveSchemaSelection({
   catalog,
   previousSelection,
   request,
}: {
   catalog: SchemaCatalog;
   previousSelection?: SchemaSelectionScope;
   request: SchemaSelectionRequest;
}): Promise<SchemaSelectionResult> {
   validatePreviousSelection(previousSelection, catalog);

   const available = catalog.objects.map(({ id, kind }) => ({ id, kind, selected: false })).sort(compareSelectionObject);
   const availableById = new Map(available.map((object) => [object.id, object]));
   const previousById = new Map(previousSelection?.objects.map((object) => [object.id, object]) ?? []);
   const removedObjects = (previousSelection?.objects ?? []).filter((object) => !availableById.has(object.id)).sort(compareSelectionObject);
   const newObjects = available.filter((object) => previousSelection !== undefined && !previousById.has(object.id));

   let selectedIds: Set<string>;
   if (request.mode === "interactive") {
      const firstRun = previousSelection === undefined;
      const reviewObjects = catalog.objects.map((object): SchemaSelectionReviewObject => ({
         id: object.id,
         schema: object.schema,
         name: object.name,
         kind: object.kind,
         selected: firstRun ? true : (previousById.get(object.id)?.selected ?? false),
         status: !firstRun && !previousById.has(object.id) ? "new" : "existing",
      }));
      const response = await request.review({
         schemas: [...catalog.schemas],
         objects: reviewObjects,
         removedObjects,
         firstRun,
      });
      if (removedObjects.length > 0 && !response.confirmRemoved) {
         throw new SchemaSelectionError("Removed schema objects require explicit confirmation before pruning");
      }
      selectedIds = resolveIdentities(response.selected, available, "interactive selection");
   } else {
      selectedIds = resolveNonInteractiveSelection(request, available);
   }

   if (selectedIds.size === 0) {
      throw new SchemaSelectionError("Schema selection resolved to an empty allowlist");
   }

   const objects = available.map((object) => ({ ...object, selected: selectedIds.has(object.id) }));
   const scope: SchemaSelectionScope = {
      formatVersion: SCHEMA_SELECTION_FORMAT_VERSION,
      catalogFormatVersion: catalog.formatVersion,
      catalogFingerprint: catalog.fingerprint,
      objects,
   };

   return {
      scope,
      selectedObjects: objects.filter((object) => object.selected),
      deselectedObjects: objects.filter((object) => !object.selected),
      newObjects: newObjects.map((object) => ({ ...object, selected: false })),
      removedObjects,
   };
}

export function reconcileSchemaSelection({
   catalog,
   selection,
}: {
   catalog: SchemaCatalog;
   selection: SchemaSelectionScope;
}): SchemaSelectionResult {
   validatePreviousSelection(selection, catalog);
   const available = catalog.objects.map(({ id, kind }) => ({ id, kind, selected: false })).sort(compareSelectionObject);
   const availableById = new Map(available.map((object) => [object.id, object]));
   const previousById = new Map(selection.objects.map((object) => [object.id, object]));
   const removedObjects = selection.objects.filter((object) => !availableById.has(object.id)).sort(compareSelectionObject);
   const newObjects = available.filter((object) => !previousById.has(object.id));
   const objects = available.map((object) => ({ ...object, selected: previousById.get(object.id)?.selected ?? false }));
   const selectedObjects = objects.filter((object) => object.selected);
   if (selectedObjects.length === 0) {
      throw new SchemaSelectionError("Stored schema selection resolved to an empty allowlist");
   }

   return {
      scope: {
         formatVersion: SCHEMA_SELECTION_FORMAT_VERSION,
         catalogFormatVersion: catalog.formatVersion,
         catalogFingerprint: catalog.fingerprint,
         objects,
      },
      selectedObjects,
      deselectedObjects: objects.filter((object) => !object.selected),
      newObjects: newObjects.map((object) => ({ ...object, selected: false })),
      removedObjects,
   };
}

export async function selectSchemaObjects({
   catalog,
   request,
   profile,
   configPath,
   selectionConfigPath,
   previousSelection,
}: {
   catalog: SchemaCatalog;
   request: SchemaSelectionRequest;
   profile: string;
   configPath: string;
   selectionConfigPath?: string;
   previousSelection?: SchemaSelectionScope;
}): Promise<SchemaSelectionResult & { selectionConfigPath: string }> {
   if (!profile.trim()) throw new SchemaSelectionError("A resolved Vexnor profile is required for schema selection");
   const filePath = resolveLocalSelectionPath(configPath, selectionConfigPath);
   const localSelection = previousSelection === undefined ? await loadLocalSelection(filePath) : undefined;
   const prior = previousSelection ?? localSelection?.profiles[profile];
   const result = await resolveSchemaSelection({ catalog, previousSelection: prior, request });

   if (request.mode === "interactive" || request.save === true) {
      await saveLocalSelection({ filePath, profile, scope: result.scope });
   }

   return { ...result, selectionConfigPath: filePath };
}

function resolveNonInteractiveSelection(
   request: NonInteractiveSchemaSelectionRequest,
   available: SchemaSelectionObject[],
): Set<string> {
   if (request.all === true && request.include !== undefined) {
      throw new SchemaSelectionError("--all conflicts with --include");
   }
   if (request.all !== true && request.include === undefined && request.exclude === undefined) {
      throw new SchemaSelectionError("Non-interactive selection requires --all, --include, or --exclude");
   }

   const included = request.all === true || request.include === undefined
      ? new Set(available.map((object) => object.id))
      : resolveIdentities(request.include, available, "include");
   const excluded = resolveIdentities(request.exclude ?? [], available, "exclude");
   const conflicts = [...included].filter((id) => excluded.has(id));
   if (request.include !== undefined && conflicts.length > 0) {
      throw new SchemaSelectionError(`Conflicting included and excluded schema objects: ${conflicts.join(", ")}`);
   }
   for (const id of excluded) included.delete(id);
   return included;
}

function resolveIdentities(
   requested: readonly string[],
   available: SchemaSelectionObject[],
   label: string,
): Set<string> {
   const duplicateInputs = duplicates(requested);
   if (duplicateInputs.length > 0) {
      throw new SchemaSelectionError(`Duplicate ${label} entries: ${duplicateInputs.join(", ")}`);
   }

   const resolved = requested.map((identity) => resolveIdentity(identity, available));
   const duplicateResolved = duplicates(resolved);
   if (duplicateResolved.length > 0) {
      throw new SchemaSelectionError(`Duplicate ${label} identities: ${duplicateResolved.join(", ")}`);
   }
   return new Set(resolved);
}

function resolveIdentity(identity: string, available: SchemaSelectionObject[]): string {
   const trimmed = identity.trim();
   if (!trimmed) throw new SchemaSelectionError("Schema object identities cannot be empty");
   const exact = available.find((object) => object.id === trimmed);
   if (exact) return exact.id;

   if (!trimmed.includes(".")) {
      const matches = available.filter((object) => object.id.endsWith(`.${trimmed}`));
      if (matches.length > 1) {
         throw new SchemaSelectionError(`Ambiguous schema object identity '${trimmed}': ${matches.map((object) => object.id).join(", ")}`);
      }
      if (matches.length === 1) return matches[0]!.id;
   }

   throw new SchemaSelectionError(`Unknown schema object identity: ${trimmed}`);
}

function validatePreviousSelection(previous: SchemaSelectionScope | undefined, catalog: SchemaCatalog): void {
   if (!previous) return;
   if (previous.formatVersion !== SCHEMA_SELECTION_FORMAT_VERSION) {
      throw new SchemaSelectionError(`Unsupported schema selection format version: ${previous.formatVersion}`);
   }
   if (previous.catalogFormatVersion !== catalog.formatVersion) {
      throw new SchemaSelectionError(
         `Schema selection catalog version ${previous.catalogFormatVersion} does not match catalog version ${catalog.formatVersion}`,
      );
   }
   const duplicateIds = duplicates(previous.objects.map((object) => object.id));
   if (duplicateIds.length > 0) {
      throw new SchemaSelectionError(`Duplicate previous schema selection identities: ${duplicateIds.join(", ")}`);
   }
}

function duplicates(values: readonly string[]): string[] {
   const seen = new Set<string>();
   const duplicates = new Set<string>();
   for (const value of values) {
      if (seen.has(value)) duplicates.add(value);
      seen.add(value);
   }
   return [...duplicates].sort();
}

function compareSelectionObject(a: SchemaSelectionObject, b: SchemaSelectionObject): number {
   return a.id.localeCompare(b.id);
}
