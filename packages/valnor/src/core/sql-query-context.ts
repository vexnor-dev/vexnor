import { SqlBuildError } from "./sql-build-error.js";

// --- Final Architecture: True Stateful Lexical Analyzer ---

const MAJOR_KEYWORDS: string[] = [
  "partition by", "order by", "group by", "insert into", "delete from",
  "select", "from", "where", "join", "on", "having", "limit", "offset",
  "update", "returning", "values", "set", "fn", "over"
].sort((a, b) => b.length - a.length);

const SUBQUERY_STARTERS: string[] = ["from", "join", "in"];

export interface SqlQueryContextOptions {
  queryName: string;
}

export class SqlQueryContext {
  readonly queryName: string;
  rawString?: string;
  strings: string[] = [];
  values: unknown[] = [];

  private readonly keywordStacks: string[][] = [[]];
  private readonly contextParenDepths: number[] = [0];
  private parenDepth = 0;

  constructor(args: SqlQueryContextOptions) {
    this.queryName = args.queryName;
  }

  private get currentStack(): string[] {
    return this.keywordStacks[this.keywordStacks.length - 1]!;
  }

  get keyword(): string | undefined {
    const stack = this.currentStack;
    for (let i = stack.length - 1; i >= 0; i--) {
      const keyword = stack[i]!;
      if (MAJOR_KEYWORDS.includes(keyword)) {
        return keyword;
      }
    }
    return undefined;
  }

  next(text: string) {
    this.rawString = text;
    const tokens = this.tokenize(text);

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

  private tokenize(text: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    const lowerText = text.toLowerCase();

    while (i < text.length) {
      const remaining = lowerText.substring(i);

      const wsMatch = remaining.match(/^\s+/);
      if (wsMatch) {
        i += wsMatch[0].length;
        continue;
      }

      if (remaining.startsWith('--')) {
        const end = lowerText.indexOf('\n', i);
        i = end === -1 ? text.length : end;
        continue;
      }
      if (remaining.startsWith('/*')) {
        const end = lowerText.indexOf('*/', i);
        i = end === -1 ? text.length : end + 2;
        continue;
      }

      const quoteMatch = remaining.match(/^('|"|`|\$\$)/);
      if (quoteMatch) {
        const quoteChar = quoteMatch[1]!;
        const ender = quoteChar === '$$' ? '$$' : quoteChar;
        const end = lowerText.indexOf(ender, i + quoteChar.length);
        i = end === -1 ? text.length : end + ender.length;
        continue; // Skip the content of the string
      }

      let matched = false;
      for (const keyword of MAJOR_KEYWORDS) {
        if (remaining.startsWith(keyword) && (remaining.length === keyword.length || /\W/.test(remaining[keyword.length]!))) {
          tokens.push(keyword);
          i += keyword.length;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      const char = remaining[0]!;
      if ('(),'.includes(char)) {
        tokens.push(char);
        i++;
        continue;
      }

      const tokenMatch = remaining.match(/^[a-z_][\w]*|^[0-9]+.?[0-9]*|^[-><>=!*+\/%]+|^[?@]|\$[0-9]+/);
      if (tokenMatch) {
        const token = tokenMatch[0]!;
        if ('?@'.includes(token) || token.startsWith('$')) {
           throw new SqlBuildError(`Query contains forbidden parameter characters (?, @, $). Use param() instead.`, { queryName: this.queryName });
        }
        tokens.push(token);
        i += token.length;
        continue;
      }

      i++;
    }
    return tokens;
  }

  child(args: SqlQueryContextOptions): SqlQueryContext {
    const result = new SqlQueryContext(args);
    result.strings = this.strings;
    result.values = this.values;
    return result;
  }
}
