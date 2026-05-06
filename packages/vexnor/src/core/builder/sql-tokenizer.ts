export interface ITokenizer {
   /**
    * Converts a raw SQL string into a series of tokens.
    * @param text The raw SQL string.
    */
   tokenize(text: string): string[];
}
