export class Lazy<T> {
   readonly callback: () => T;

   private _value: T | null;
   private _computed = false;

   constructor(callback: () => T) {
      this.callback = callback;
      this._value = null;
   }

   get value(): T {
      if (this._computed) {
         return this._value!;
      }

      this._value = this.callback();
      this._computed = true;
      return this._value!;
   }
}
