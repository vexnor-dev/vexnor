export class Cache<K, V> {
   private map: Map<K, V>;

   constructor() {
      this.map = new Map<K, V>();
   }

   get(key: K, callback: (key: K) => V) {
      if (this.map.has(key)) return this.map.get(key);

      this.map.set(key, callback(key));
   }
}

export function cache<K, V, T extends Map<K, V>>(map: T) {
   return {
      get(key: K, callback: () => V) {
         if (map.has(key)) return map.get(key);

         map.set(key, callback());
         return map.get(key);
      },
   };
}
