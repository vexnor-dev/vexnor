const INTERNAL_FILES = [
   "/core/query/sql-query.ts",
   "/core/query/sql-query.js",
   "/core/query/sql-query-handler.ts",
   "/core/query/sql-query-handler.js",
   "/core/query/sql-select-value.ts",
   "/core/query/sql-select-value.js",
   "/core/sql.ts",
   "/core/sql.js",
];

function isInternalFrame(frame: string): boolean {
   if (INTERNAL_FILES.some((f) => frame.includes(f))) return true;
   // Plugin/ORM packages: plugins/postgres, orms/prisma, etc. (src or dist)
   if (/\/(plugins|orms)\/[^/]+\/(dist|src)\//.test(frame) || /\/@fs\/.*\/(plugins|orms)\/[^/]+\/(dist|src)\//.test(frame)) return true;
   // Core vexnor package src/dist (e.g. sql-base.ts, builder/, execution/)
   return /\/vexnor\/(dist|src)\//.test(frame) || /\/@fs\/.*\/vexnor\/(dist|src)\//.test(frame);
}

export function parseCallerLocation(stack: string | undefined, internalUrl: string): { location: string | null; locationUrl: string | null } {
   if (!stack) return { location: null, locationUrl: null };
   const internalPath = stripFileUrl(internalUrl);
   const parts = internalPath.split("/");
   const srcOrDistIndex = Math.max(parts.lastIndexOf("src"), parts.lastIndexOf("dist"));
   const packageRoot = parts.slice(0, srcOrDistIndex - 2).join("/") + "/";
   const frames = stack.split("\n").filter((line) => line.includes(" at "));
   const isUserFrame = (f: string) => {
      if (isInternalFrame(f) || f.includes("/node_modules/") || f.includes("node:")) return false;
      const match = f.match(/\((.+)\)$/) ?? f.match(/at (.+)$/);
      const location = match?.[1]?.trim();
      return !!location && location !== "<anonymous>";
   };
   // Bottom-up: finds the outermost user call site (best for browser/lazy construction)
   // Fall back to top-down: finds the innermost user call site (best for server module load)
   const caller = [...frames].reverse().find(isUserFrame) ?? frames.find(isUserFrame);
   if (!caller) return { location: null, locationUrl: null };
   const match = caller.match(/\((.+)\)$/) ?? caller.match(/at (.+)$/);
   const rawLocation = match?.[1]?.trim() ?? null;
   if (!rawLocation) return { location: null, locationUrl: null };
   // Resolve the URL for getQueryName:
   // - Browser: keep the original http:// URL (Vite can import it), strip line/col
   // - Node: convert absolute path to file:// URL, strip line/col
   let locationUrl: string | null;
   const httpOriginMatch = rawLocation.match(/^(https?:\/\/[^/]+\/[^:?]+)/s);
   if (httpOriginMatch) {
      locationUrl = httpOriginMatch[1]!;
   } else {
      const absPath = stripViteFs(rawLocation).replace(/:\d+:\d+$/, "");
      locationUrl = absPath.startsWith("/") ? `file://${absPath}` : null;
   }
   const resolved = httpOriginMatch ? stripViteFs(rawLocation.replace(/^https?:\/\/[^/]+/, "")) : stripViteFs(rawLocation);
   const resolvedNoLineCol = resolved.replace(/:\d+:\d+$/, "");
   if (resolvedNoLineCol.startsWith(packageRoot)) return { location: resolved.slice(packageRoot.length), locationUrl };
   return { location: resolved, locationUrl };
}

function stripViteFs(location: string): string {
   // Vite serves monorepo files under /@fs/abs/path — strip to get the absolute path,
   // then strip the common prefix with packageRoot if present
   return location.startsWith("/@fs/") ? location.slice(4) : location;
}

function stripFileUrl(url: string): string {
   if (url.startsWith("file://")) return url.slice(7);
   // Vite serves files as http://host/@fs/abs/path — extract the absolute path
   const viteMatch = url.match(/^https?:\/\/[^/]+\/@fs(\/.*)/s);
   if (viteMatch) return viteMatch[1]!;
   // Plain http origin — strip host, keep path
   const httpMatch = url.match(/^https?:\/\/[^/]+(\/.*)/s);
   if (httpMatch) return httpMatch[1]!;
   return url;
}
