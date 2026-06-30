export function findQueryComment(strings: ReadonlyArray<string> | string[]): string | undefined {
   const head = strings[0];
   if (!head) return;

   const start = head.indexOf("/*");
   if (start < 0) return;

   const end = head.indexOf("*/", start);
   if (end < 0) return;

   return head.substring(start + 2, end).trim();
}
