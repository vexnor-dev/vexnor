export const tags = new Map<string, string>();

export function getTag(arg: { name: string }): string {
   if (tags.has(arg.name)) {
      return tags.get(arg.name)!;
   }

   tags.set(arg.name, `tag_${tags.size + 1}`);
   return tags.get(arg.name)!;
}
