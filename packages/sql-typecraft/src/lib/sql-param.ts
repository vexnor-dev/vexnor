export class SqlParam<TName extends string> {
   name: TName;
   static PREFIX = "@";

   constructor(name: TName) {
      if (name.startsWith(SqlParam.PREFIX)) throw new TypeError(`Param name must not start with ${SqlParam.PREFIX}`);
      this.name = name;
   }

   get wildcard(): string {
      return `${SqlParam.PREFIX}${this.name}`;
   }
}

export function param<T extends string>(name: T): SqlParam<T> {
   return new SqlParam<T>(name);
}
