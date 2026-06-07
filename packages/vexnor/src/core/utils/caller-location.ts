const INTERNAL_FILES = ["/core/query/sql-query.ts", "/core/query/sql-query.js", "/core/sql.ts", "/core/sql.js"];

export function parseCallerLocation(stack: string | undefined, internalUrl: string): string | null {
   if (!stack) return null;
   const internalPath = stripFileUrl(internalUrl);
   const parts = internalPath.split("/");
   const srcOrDistIndex = Math.max(parts.lastIndexOf("src"), parts.lastIndexOf("dist"));
   // packageRoot: parent of src/ or dist/ — stable stripping anchor
   const packageRoot = parts.slice(0, srcOrDistIndex).join("/") + "/";
   const frames = stack.split("\n").filter((line) => line.includes(" at "));
   let lastInternal = -1;
   for (let i = 0; i < frames.length; i++) {
      if (INTERNAL_FILES.some((f) => frames[i]!.includes(f))) lastInternal = i;
   }
   const caller = frames.slice(lastInternal + 1).find((f) => !f.includes("/node_modules/"));
   if (!caller) return null;
   const match = caller.match(/\((.+)\)$/) ?? caller.match(/at (.+)$/);
   const location = match?.[1]?.trim() ?? null;
   if (!location) return null;
   return location.startsWith(packageRoot) ? location.slice(packageRoot.length) : location;
}

function stripFileUrl(url: string): string {
   return url.startsWith("file://") ? url.slice(7) : url;
}
