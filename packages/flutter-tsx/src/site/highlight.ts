import { escapeHtml } from './render';

/**
 * Syntax highlighting for the two languages these pages show.
 *
 * Done at generation time rather than by a script in the page: the pages stay
 * static, nothing is fetched from a CDN, and the result is a string a test can
 * assert. It is a lexer, not a parser — enough to colour code correctly, and
 * small enough to be read in one sitting.
 *
 * The one invariant that matters is that highlighting never changes the code:
 * stripped of its markup, the output is the input. That is asserted for every
 * fixture in the suite, so a lexing mistake cannot quietly corrupt a snippet.
 */
export type Language = 'tsx' | 'dart' | 'typescript';

const SHARED_KEYWORDS = [
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'else',
  'enum',
  'export',
  'extends',
  'external',
  'factory',
  'false',
  'final',
  'finally',
  'for',
  'get',
  'if',
  'implements',
  'import',
  'in',
  'interface',
  'is',
  'late',
  'let',
  'new',
  'null',
  'of',
  'operator',
  'part',
  'private',
  'public',
  'required',
  'rethrow',
  'return',
  'set',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typedef',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
];

const TS_ONLY = ['from', 'function', 'readonly', 'undefined'];
const DART_ONLY = [
  'abstract',
  'covariant',
  'extension',
  'hide',
  'mixin',
  'on',
  'show',
  'sync',
];

const keywordsFor = (language: Language): ReadonlySet<string> =>
  new Set([...SHARED_KEYWORDS, ...(language === 'dart' ? DART_ONLY : TS_ONLY)]);

/**
 * Ordered: whatever matches first wins, so a keyword inside a string stays a
 * string. Every branch captures its whole token, and anything unmatched is
 * consumed one character at a time as plain text.
 */
const TOKEN =
  /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(r?'(?:\\.|\$\{[^}]*\}|[^'\\])*')|(r?"(?:\\.|\$\{[^}]*\}|[^"\\])*")|(`(?:\\.|\$\{[^}]*\}|[^`\\])*`)|(\b\d[\d._]*\b)|([A-Za-z_$][\w$]*)/g;

const CLASS: Record<string, string> = {
  comment: 'tok-com',
  string: 'tok-str',
  number: 'tok-num',
  keyword: 'tok-kw',
  type: 'tok-typ',
  call: 'tok-fn',
};

const span = (kind: string, text: string): string =>
  `<span class="${CLASS[kind] ?? ''}">${escapeHtml(text)}</span>`;

const UPPER_FIRST = /^[A-Z]/;

const identifierSpan = (
  name: string,
  after: string,
  keywords: ReadonlySet<string>,
): string => {
  if (keywords.has(name)) return span('keyword', name);
  if (UPPER_FIRST.test(name)) return span('type', name);
  // `foo(` and `foo<T>(` read as a call; a bare identifier is just a value.
  if (after.startsWith('(')) return span('call', name);
  return escapeHtml(name);
};

/**
 * Where in a TSX file a position falls: inside code, inside a tag's own
 * markup, or in the text between tags. Without this, the words a component
 * renders — `<Text>Content</Text>` — colour like types, because a lexer has
 * no other way to tell a capitalised word from a component name.
 */
const TAG_OPEN = /^<\/?[A-Za-z]/;

const jsxTextRanges = (code: string): boolean[] => {
  const inText = new Array<boolean>(code.length).fill(false);
  let tag = false;
  let text = false;
  let braces = 0;

  for (let index = 0; index < code.length; index += 1) {
    const char = code[index] ?? '';
    if (braces === 0 && TAG_OPEN.test(code.slice(index))) {
      tag = true;
      text = false;
    } else if (tag && char === '>') {
      // Only a tag's own `>` starts a text run — never `=>` or a comparison.
      tag = false;
      text = true;
      continue;
    } else if (text && char === '{') {
      braces += 1;
    } else if (text && char === '}' && braces > 0) {
      braces -= 1;
    }
    inText[index] = text && braces === 0;
  }
  return inText;
};

/** The code as HTML, with each token wrapped in the class that colours it. */
export const highlight = (code: string, language: Language): string => {
  const keywords = keywordsFor(language);
  const inText = language === 'dart' ? null : jsxTextRanges(code);
  const out: string[] = [];
  let last = 0;

  for (const match of code.matchAll(TOKEN)) {
    const [text] = match;
    const start = match.index;
    if (start > last) {
      out.push(escapeHtml(code.slice(last, start)));
    }
    last = start + text.length;

    const [, lineComment, blockComment, single, double, template, number] =
      match;
    if (lineComment !== undefined || blockComment !== undefined) {
      out.push(span('comment', text));
    } else if (
      single !== undefined ||
      double !== undefined ||
      template !== undefined
    ) {
      out.push(span('string', text));
    } else if (number !== undefined) {
      out.push(span('number', text));
    } else if (inText?.[start] === true) {
      // Words a component renders are prose, not identifiers.
      out.push(escapeHtml(text));
    } else {
      out.push(identifierSpan(text, code.slice(last), keywords));
    }
  }

  out.push(escapeHtml(code.slice(last)));
  return out.join('');
};

/** A highlighted `<pre><code>` block, the shape every page uses. */
export const codeBlock = (code: string, language: Language): string =>
  `<pre><code class="language-${language}">${highlight(code.trimEnd(), language)}</code></pre>`;

/** The palette the token classes resolve to, shared by every generated page. */
export const HIGHLIGHT_CSS = `
  .tok-com { color: #6b7a90; font-style: italic; }
  .tok-str { color: #a5d6a7; }
  .tok-num { color: #ffcc80; }
  .tok-kw  { color: #c792ea; }
  .tok-typ { color: #82aaff; }
  .tok-fn  { color: #64d8cb; }
`;
