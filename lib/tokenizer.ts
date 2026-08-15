/**
 * Lightweight line-level tokeniser for read-only code display.
 *
 * Covers JS / TS / JSX / TSX / HTML / CSS / Markdown.
 * This is intentionally NOT a full parser — it handles the common
 * visual cases well enough for syntax-highlighted display without
 * pulling in a 200 kB grammar library.
 */

/* ── Public types ──────────────────────────────────────── */

export type TokenKind =
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "component"
  | "tag"
  | "plain";

export interface SyntaxToken {
  text: string;
  kind: TokenKind;
}

/* ── Palette (Material Palenight) ──────────────────────── */

/**
 * Maps each token kind to a hex colour.
 * Chosen to pair well with the FeatherRouter dark-blue editor
 * background (#0b0f1a).
 */
export const TOKEN_PALETTE: Readonly<Record<TokenKind, string>> = {
  keyword:   "#c792ea",
  string:    "#c3e88d",
  comment:   "#546e7a",
  number:    "#f78c6c",
  component: "#ffcb6b",
  tag:       "#f07178",
  plain:     "#c9d1d9",
};

/* ── Keyword set ───────────────────────────────────────── */

const KEYWORDS: ReadonlySet<string> = new Set([
  "import", "from", "export", "default", "const", "let", "var", "function",
  "return", "if", "else", "class", "interface", "type", "async", "await",
  "new", "throw", "try", "catch", "for", "while", "do", "switch", "case",
  "break", "continue", "typeof", "instanceof", "void", "null", "undefined",
  "true", "false", "extends", "implements", "static", "super", "this",
  "yield", "enum", "readonly", "as", "is", "keyof", "in", "of", "declare",
  "namespace", "module", "require", "satisfies",
]);

/* ── Tokeniser ─────────────────────────────────────────── */

/** Merge `text` into the previous token when the kind matches. */
function push(tokens: SyntaxToken[], text: string, kind: TokenKind) {
  const prev = tokens[tokens.length - 1];
  if (prev?.kind === kind) {
    prev.text += text;
  } else {
    tokens.push({ text, kind });
  }
}

/**
 * Tokenise a single source line into a flat list of coloured spans.
 *
 * The cursor walks left-to-right, greedily matching the longest
 * construct first (comments → strings → identifiers → numbers → tags).
 * Unrecognised characters are collapsed into adjacent "plain" tokens.
 */
export function tokenizeLine(line: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    const ch = line[cursor];
    const rest = line.slice(cursor);

    /* ── Line comment (//) ─────────────────────────── */
    if (ch === "/" && line[cursor + 1] === "/") {
      push(tokens, rest, "comment");
      return tokens;
    }

    /* ── Block comment (single-line span only) ─────── */
    if (ch === "/" && line[cursor + 1] === "*") {
      const end = line.indexOf("*/", cursor + 2);
      const slice = end !== -1 ? line.slice(cursor, end + 2) : rest;
      push(tokens, slice, "comment");
      cursor += slice.length;
      continue;
    }

    /* ── HTML comment ──────────────────────────────── */
    if (rest.startsWith("<!--")) {
      const end = line.indexOf("-->", cursor + 4);
      const slice = end !== -1 ? line.slice(cursor, end + 3) : rest;
      push(tokens, slice, "comment");
      cursor += slice.length;
      continue;
    }

    /* ── String / template literals ────────────────── */
    if (ch === '"' || ch === "'" || ch === "`") {
      let end = cursor + 1;
      while (end < line.length) {
        if (line[end] === "\\") { end += 2; continue; }
        if (line[end] === ch) { end++; break; }
        end++;
      }
      push(tokens, line.slice(cursor, end), "string");
      cursor = end;
      continue;
    }

    /* ── Identifiers & keywords ────────────────────── */
    const wordMatch = rest.match(/^[a-zA-Z_$]\w*/);
    if (wordMatch) {
      const word = wordMatch[0];
      push(tokens, word, KEYWORDS.has(word) ? "keyword" : "plain");
      cursor += word.length;
      continue;
    }

    /* ── Numeric literals ──────────────────────────── */
    const numMatch = rest.match(/^\d+(\.\d+)?([eE][+-]?\d+)?/);
    if (numMatch) {
      push(tokens, numMatch[0], "number");
      cursor += numMatch[0].length;
      continue;
    }

    /* ── JSX / HTML open/close tags ────────────────── */
    if (ch === "<") {
      const tagMatch = rest.match(/^<\/?[a-zA-Z]\w*/);
      if (tagMatch) {
        const kind: TokenKind = /^<\/?[A-Z]/.test(tagMatch[0]) ? "component" : "tag";
        push(tokens, tagMatch[0], kind);
        cursor += tagMatch[0].length;
        continue;
      }
    }

    /* ── Fallback: plain character ─────────────────── */
    push(tokens, ch, "plain");
    cursor++;
  }

  return tokens;
}
