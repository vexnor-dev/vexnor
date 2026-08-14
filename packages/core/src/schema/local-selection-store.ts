import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
   SCHEMA_SELECTION_FORMAT_VERSION,
   type SchemaSelectionObject,
   type SchemaSelectionScope,
} from "#src/schema/schema-selection.js";

export const LOCAL_SELECTION_FORMAT_VERSION = 1 as const;

export type LocalSelectionDocument = {
   formatVersion: typeof LOCAL_SELECTION_FORMAT_VERSION;
   profiles: Record<string, SchemaSelectionScope>;
};

export class LocalSelectionConfigError extends Error {
   readonly code = "INVALID_LOCAL_SELECTION_CONFIG";

   constructor(message: string, options?: ErrorOptions) {
      super(message, options);
      this.name = "LocalSelectionConfigError";
   }
}

export function resolveLocalSelectionPath(configPath: string, overridePath?: string): string {
   const resolvedConfigPath = path.resolve(configPath);
   if (!overridePath) return path.join(path.dirname(resolvedConfigPath), "vexnor.local.json");
   return path.isAbsolute(overridePath) ? overridePath : path.resolve(path.dirname(resolvedConfigPath), overridePath);
}

export async function loadLocalSelection(filePath: string): Promise<LocalSelectionDocument> {
   let contents: string;
   try {
      contents = await readFile(filePath, "utf8");
   } catch (error) {
      if (isNodeErrorWithCode(error, "ENOENT")) {
         return emptyLocalSelection();
      }
      throw new LocalSelectionConfigError(`Failed to read local selection config: ${filePath}`, { cause: error });
   }

   let value: unknown;
   try {
      value = JSON.parse(contents);
   } catch (error) {
      throw new LocalSelectionConfigError(`Malformed JSON in local selection config: ${filePath}`, { cause: error });
   }
   return validateLocalSelection(value, filePath);
}

export async function saveLocalSelection({
   filePath,
   profile,
   scope,
}: {
   filePath: string;
   profile: string;
   scope: SchemaSelectionScope;
}): Promise<void> {
   if (!profile.trim()) throw new LocalSelectionConfigError("Local selection profile name cannot be empty");
   validateScope(scope, `profile '${profile}'`);
   const existing = await loadLocalSelection(filePath);
   const document: LocalSelectionDocument = {
      formatVersion: LOCAL_SELECTION_FORMAT_VERSION,
      profiles: { ...existing.profiles, [profile]: normalizeScope(scope) },
   };
   const directory = path.dirname(filePath);
   await mkdir(directory, { recursive: true });
   const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
   try {
      await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
      await rename(temporaryPath, filePath);
   } catch (error) {
      try {
         await unlink(temporaryPath);
      } catch (cleanupError) {
         if (!isNodeErrorWithCode(cleanupError, "ENOENT")) {
            throw new LocalSelectionConfigError(`Failed to clean up local selection temporary file: ${temporaryPath}`, {
               cause: cleanupError,
            });
         }
      }
      throw new LocalSelectionConfigError(`Failed to atomically write local selection config: ${filePath}`, { cause: error });
   }
}

function emptyLocalSelection(): LocalSelectionDocument {
   return { formatVersion: LOCAL_SELECTION_FORMAT_VERSION, profiles: {} };
}

function validateLocalSelection(value: unknown, filePath: string): LocalSelectionDocument {
   if (!isRecord(value)) throw new LocalSelectionConfigError(`Local selection config must be an object: ${filePath}`);
   assertOnlyKeys(value, ["formatVersion", "profiles"], "local selection config");
   if (value.formatVersion !== LOCAL_SELECTION_FORMAT_VERSION) {
      throw new LocalSelectionConfigError(`Unsupported local selection format version: ${String(value.formatVersion)}`);
   }
   if (!isRecord(value.profiles)) throw new LocalSelectionConfigError("Local selection profiles must be an object");

   const profiles: Record<string, SchemaSelectionScope> = {};
   for (const [profile, scope] of Object.entries(value.profiles)) {
      if (!profile.trim()) throw new LocalSelectionConfigError("Local selection profile name cannot be empty");
      profiles[profile] = validateScope(scope, `profile '${profile}'`);
   }
   return { formatVersion: LOCAL_SELECTION_FORMAT_VERSION, profiles };
}

function validateScope(value: unknown, label: string): SchemaSelectionScope {
   if (!isRecord(value)) throw new LocalSelectionConfigError(`Local selection ${label} must be an object`);
   assertOnlyKeys(value, ["formatVersion", "catalogFormatVersion", "catalogFingerprint", "objects"], label);
   if (value.formatVersion !== SCHEMA_SELECTION_FORMAT_VERSION) {
      throw new LocalSelectionConfigError(`Unsupported schema selection format version in ${label}: ${String(value.formatVersion)}`);
   }
   if (!Number.isInteger(value.catalogFormatVersion) || Number(value.catalogFormatVersion) < 1) {
      throw new LocalSelectionConfigError(`Invalid catalog format version in ${label}`);
   }
   if (typeof value.catalogFingerprint !== "string" || !value.catalogFingerprint) {
      throw new LocalSelectionConfigError(`Invalid catalog fingerprint in ${label}`);
   }
   if (!Array.isArray(value.objects)) throw new LocalSelectionConfigError(`Local selection objects in ${label} must be an array`);

   const objects = value.objects.map((object, index) => validateSelectionObject(object, `${label} object ${index}`));
   const ids = new Set<string>();
   for (const object of objects) {
      if (ids.has(object.id)) throw new LocalSelectionConfigError(`Duplicate schema object identity in ${label}: ${object.id}`);
      ids.add(object.id);
   }
   return {
      formatVersion: SCHEMA_SELECTION_FORMAT_VERSION,
      catalogFormatVersion: Number(value.catalogFormatVersion),
      catalogFingerprint: value.catalogFingerprint,
      objects: objects.sort((a, b) => a.id.localeCompare(b.id)),
   };
}

function validateSelectionObject(value: unknown, label: string): SchemaSelectionObject {
   if (!isRecord(value)) throw new LocalSelectionConfigError(`${label} must be an object`);
   assertOnlyKeys(value, ["id", "kind", "selected"], label);
   if (typeof value.id !== "string" || !isSchemaQualifiedObjectIdentity(value.id)) {
      throw new LocalSelectionConfigError(`Invalid schema-qualified object identity in ${label}`);
   }
   if (value.kind !== "table" && value.kind !== "view") {
      throw new LocalSelectionConfigError(`Invalid object kind in ${label}: ${String(value.kind)}`);
   }
   if (typeof value.selected !== "boolean") throw new LocalSelectionConfigError(`Invalid selected state in ${label}`);
   return { id: value.id, kind: value.kind, selected: value.selected };
}

function isSchemaQualifiedObjectIdentity(value: string): boolean {
   const separator = value.indexOf(".");
   return separator > 0 && separator < value.length - 1;
}

function normalizeScope(scope: SchemaSelectionScope): SchemaSelectionScope {
   return {
      ...scope,
      objects: [...scope.objects].sort((a, b) => a.id.localeCompare(b.id)),
   };
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
   const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
   if (unexpected.length > 0) {
      throw new LocalSelectionConfigError(`Unexpected fields in ${label}: ${unexpected.sort().join(", ")}`);
   }
}

function isRecord(value: unknown): value is Record<string, unknown> {
   return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
   return error instanceof Error && "code" in error && error.code === code;
}
