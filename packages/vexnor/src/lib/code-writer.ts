export type CodeWriterOptions = {
   newLine?: string;
   useTabs?: boolean;
   indentNumberOfSpaces?: number;
   useSingleQuote?: boolean;
};

export class CodeWriter {
   private readonly newLineText: string;
   private readonly indentText: string;
   private readonly quoteText: string;
   private readonly chunks: string[] = [];
   private indentLevel = 0;
   private atLineStart = true;

   constructor(options: CodeWriterOptions = {}) {
      this.newLineText = options.newLine ?? "\n";
      this.indentText = options.useTabs ? "\t" : " ".repeat(options.indentNumberOfSpaces ?? 3);
      this.quoteText = options.useSingleQuote === false ? `"` : `'`;
   }

   write(text = ""): this {
      if (!text) return this;
      this.writeIndentIfNeeded();
      this.chunks.push(text);
      return this;
   }

   writeLine(text = ""): this {
      this.write(text);
      this.newLine();
      return this;
   }

   newLine(): this {
      this.chunks.push(this.newLineText);
      this.atLineStart = true;
      return this;
   }

   blankLine(): this {
      return this.newLine();
   }

   space(): this {
      return this.write(" ");
   }

   quote(text?: string): this {
      if (text === undefined) {
         return this.write(this.quoteText);
      }

      return this.write(this.quoteText).write(text).write(this.quoteText);
   }

   block(writeBody: () => void): this {
      this.space().write("{").newLine();
      this.indentLevel++;
      writeBody();
      this.indentLevel--;
      this.writeLine("}");
      return this;
   }

   inlineBlock(writeBody: () => void): this {
      this.write("{").newLine();
      this.indentLevel++;
      writeBody();
      this.indentLevel--;
      this.write("}");
      return this;
   }

   toString(): string {
      return this.chunks.join("");
   }

   private writeIndentIfNeeded() {
      if (!this.atLineStart) return;
      if (this.indentLevel > 0) {
         this.chunks.push(this.indentText.repeat(this.indentLevel));
      }
      this.atLineStart = false;
   }
}
