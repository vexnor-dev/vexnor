export function formatJson(data: unknown[]): string {
   return JSON.stringify(data, null, 2);
}

export function formatCsv(data: unknown[]): string {
   if (data.length === 0) return "";

   const first = data[0];
   if (typeof first !== "object" || first === null) {
      throw new Error("CSV format requires array of objects");
   }

   const formatValue = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
   };

   const keys = Object.keys(first);
   const header = keys.join(",");
   const rows = data.map((row) => {
      return keys
         .map((key) => {
            const value = (row as Record<string, unknown>)[key];
            const str = formatValue(value);
            return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
         })
         .join(",");
   });

   return [header, ...rows].join("\n");
}

export function formatTable(data: unknown[]): string {
   if (data.length === 0) return "";

   const first = data[0];
   if (typeof first !== "object" || first === null) {
      throw new Error("Table format requires array of objects");
   }

   const keys = Object.keys(first);
   const formatValue = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
   };

   const colWidths = keys.map((key) => {
      const lengths = data.map((row) => {
         const value = (row as Record<string, unknown>)[key];
         return formatValue(value).length;
      });
      const maxDataWidth = lengths.length > 0 ? Math.max(...lengths) : 0;
      return Math.max(key.length, maxDataWidth);
   });

   const header = keys.map((key, i) => key.padEnd(colWidths[i] ?? 0)).join(" | ");
   const separator = colWidths.map((width) => "-".repeat(width ?? 0)).join("-+-");
   const rows = data.map((row) => {
      return keys
         .map((key, i) => {
            const value = (row as Record<string, unknown>)[key];
            const str = formatValue(value);
            return str.padEnd(colWidths[i] ?? 0);
         })
         .join(" | ");
   });

   return [header, separator, ...rows].join("\n");
}
