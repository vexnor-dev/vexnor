export type DuckDBConnectionConfig =
   | { mode: "memory" }
   | { mode: "file"; path: string }
   | { mode: "motherduck"; database: string; token: string }
   | { uri: string };

export type ResolvedDuckDBConnectionConfig = {
   cache: boolean;
   path: string;
};

export function resolveDuckDBConnectionConfig(config: DuckDBConnectionConfig): ResolvedDuckDBConnectionConfig {
   if ("uri" in config) {
      const path = requireNonEmpty(config.uri, "DuckDB uri");
      return { cache: path !== ":memory:", path };
   }

   switch (config.mode) {
      case "memory":
         return { cache: false, path: ":memory:" };
      case "file":
         return { cache: true, path: requireNonEmpty(config.path, "DuckDB file path") };
      case "motherduck": {
         const database = requireNonEmpty(config.database, "MotherDuck database");
         const token = requireNonEmpty(config.token, "MotherDuck token");
         return {
            cache: true,
            path: `md:${database}?motherduck_token=${encodeURIComponent(token)}`,
         };
      }
   }
}

function requireNonEmpty(value: string, label: string): string {
   if (!value.trim()) {
      throw new TypeError(`${label} must be a non-empty string`);
   }
   return value;
}
