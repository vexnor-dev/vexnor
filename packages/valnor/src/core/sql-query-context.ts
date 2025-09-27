import { ITokenizer } from "./sql-tokenizer.js";
import { MAJOR_KEYWORDS, SUBQUERY_STARTERS } from "./sql-constants.js"; // Corrected to relative import

export interface SqlQueryContextOptions {
  queryName: string;
  tokenizer: ITokenizer;
}

export class SqlQueryContext {
  readonly queryName: string;
  private readonly tokenizer: ITokenizer;
  rawString?: string;
  strings: string[] = [];
  values: unknown[] = [];

  private readonly keywordStacks: string[][] = [[]];
  private readonly contextParenDepths: number[] = [0];
  private parenDepth = 0;

  constructor(args: SqlQueryContextOptions) {
    this.queryName = args.queryName;
    this.tokenizer = args.tokenizer;
  }

  private get currentStack(): string[] {
    return this.keywordStacks[this.keywordStacks.length - 1]!;
  }

  get keyword(): string | undefined {
    const stack = this.currentStack;
    console.log(`[${this.queryName}] SqlQueryContext.keyword accessed. Current stack:`, stack);
    console.log(`[${this.queryName}] SqlQueryContext.keyword using MAJOR_KEYWORDS:`, MAJOR_KEYWORDS);
    for (let i = stack.length - 1; i >= 0; i--) {
      const keyword = stack[i]!;
      if (MAJOR_KEYWORDS.includes(keyword)) {
        console.log(`[${this.queryName}] SqlQueryContext.keyword found:`, keyword);
        return keyword;
      }
    }
    console.log(`[${this.queryName}] SqlQueryContext.keyword returning undefined.`);
    return undefined;
  }

  next(text: string) {
    this.rawString = text;
    const tokens = this.tokenizer.tokenize(text);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!;

      if (token === "(") {
        const prevToken = this.currentStack.length > 0 ? this.currentStack[this.currentStack.length - 1] : undefined;

        if (prevToken === 'over') {
          this.currentStack.pop(); // consume 'over'
          this.contextParenDepths.push(this.parenDepth);
          this.keywordStacks.push(['over']);
        } else if (prevToken && SUBQUERY_STARTERS.includes(prevToken)) {
          this.contextParenDepths.push(this.parenDepth);
          this.keywordStacks.push([prevToken]);
        } else if (prevToken && /^[a-z_]/.test(prevToken) && !MAJOR_KEYWORDS.includes(prevToken)) {
          this.currentStack.pop(); // It's a function call, consume the name
          this.contextParenDepths.push(this.parenDepth);
          this.keywordStacks.push(['fn']);
        } else {
           const nextMeaningfulToken = tokens.slice(i + 1).find(t => t.trim());
           if(nextMeaningfulToken === 'select') {
              this.contextParenDepths.push(this.parenDepth);
              this.keywordStacks.push([]);
           }
        }
        this.parenDepth++;
      } else if (token === ")") {
        this.parenDepth--;
        if (this.keywordStacks.length > 1 && this.parenDepth === this.contextParenDepths[this.contextParenDepths.length - 1]!) {
          this.keywordStacks.pop();
          this.contextParenDepths.pop();
        }
      } else {
        this.currentStack.push(token);
      }
    }
  }

  child(args: { queryName: string }): SqlQueryContext {
    const result = new SqlQueryContext({ ...args, tokenizer: this.tokenizer });
    result.strings = this.strings;
    result.values = this.values;
    return result;
  }
}
