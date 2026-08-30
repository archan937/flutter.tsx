import { escapeHtml } from './render';

/**
 * The markdown these docs are written in, and no more: headings, paragraphs,
 * fenced code, bullet lists, tables, and inline code, bold and links.
 *
 * A general-purpose parser would be a dependency and a much larger surface;
 * this renders exactly what the pages use, and every construct is tested.
 */

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^-\s+(.*)$/;
const FENCE = /^```(\w*)$/;
const TABLE_DIVIDER = /^\|[\s:|-]+\|$/;
const INLINE_CODE = /`([^`]+)`/g;
const BOLD = /\*\*([^*]+)\*\*/g;
const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;
// A sibling page, written as the `.md` GitHub renders. The site publishes it
// as `.html`, where the `.md` would be a raw file rather than a page.
const SIBLING_PAGE = /^(\.\/[^/:]+)\.md$/;

/** Escapes the text, then applies the inline constructs. */
const inline = (raw: string): string =>
  escapeHtml(raw)
    .replace(INLINE_CODE, (_match, code: string) => `<code>${code}</code>`)
    .replace(BOLD, (_match, text: string) => `<strong>${text}</strong>`)
    .replace(
      LINK,
      (_match, text: string, href: string) =>
        `<a href="${href.replace(SIBLING_PAGE, '$1.html')}">${text}</a>`,
    );

const cells = (row: string): string[] =>
  row
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());

const isTableRow = (line: string): boolean =>
  line.startsWith('|') && line.endsWith('|');

export const renderMarkdown = (markdown: string): string => {
  const lines = markdown.split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';

    const fence = FENCE.exec(line);
    if (fence !== null) {
      flushParagraph();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').startsWith('```')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      const language =
        fence[1] === '' ? '' : ` class="language-${fence[1] ?? ''}"`;
      blocks.push(
        `<pre><code${language}>${escapeHtml(code.join('\n'))}</code></pre>`,
      );
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      flushParagraph();
      const level = (heading[1] ?? '').length;
      blocks.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`);
      continue;
    }

    if (BULLET.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length) {
        const bullet = BULLET.exec(lines[index] ?? '');
        if (bullet === null) break;
        items.push(`<li>${inline(bullet[1] ?? '')}</li>`);
        index += 1;
      }
      index -= 1;
      blocks.push(`<ul>\n${items.join('\n')}\n</ul>`);
      continue;
    }

    if (isTableRow(line) && TABLE_DIVIDER.test(lines[index + 1] ?? '')) {
      flushParagraph();
      const header = cells(line)
        .map((cell) => `<th>${inline(cell)}</th>`)
        .join('');
      index += 2;
      const rows: string[] = [];
      while (index < lines.length && isTableRow(lines[index] ?? '')) {
        rows.push(
          `<tr>${cells(lines[index] ?? '')
            .map((cell) => `<td>${inline(cell)}</td>`)
            .join('')}</tr>`,
        );
        index += 1;
      }
      index -= 1;
      blocks.push(
        `<table>\n<thead><tr>${header}</tr></thead>\n<tbody>\n${rows.join('\n')}\n</tbody>\n</table>`,
      );
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }
    paragraph.push(line.trim());
  }

  flushParagraph();
  return blocks.join('\n');
};
