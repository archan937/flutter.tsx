import { describe, expect, test } from 'bun:test';

import { renderMarkdown } from '@src/site/markdown';

describe('renderMarkdown', () => {
  test('headings become heading elements', () => {
    expect(renderMarkdown('# Guide\n\n## Install\n\n### Detail\n')).toBe(
      '<h1>Guide</h1>\n<h2>Install</h2>\n<h3>Detail</h3>',
    );
  });

  test('paragraphs join their wrapped lines', () => {
    expect(renderMarkdown('One line\nand its wrap.\n')).toBe(
      '<p>One line and its wrap.</p>',
    );
  });

  test('a fenced block keeps its code verbatim and escaped', () => {
    expect(renderMarkdown('```sh\nfsx dev && echo <ok>\n```\n')).toBe(
      '<pre><code class="language-sh">fsx dev &amp;&amp; echo &lt;ok&gt;</code></pre>',
    );
  });

  test('inline code, bold and links render inside text', () => {
    expect(
      renderMarkdown('Run `fsx dev`, see **this** and [that](./x.html).\n'),
    ).toBe(
      '<p>Run <code>fsx dev</code>, see <strong>this</strong> and ' +
        '<a href="./x.html">that</a>.</p>',
    );
  });

  test('a bullet list becomes a list', () => {
    expect(renderMarkdown('- one\n- two\n')).toBe(
      '<ul>\n<li>one</li>\n<li>two</li>\n</ul>',
    );
  });

  test('a table renders its header and rows', () => {
    expect(
      renderMarkdown('| Command | Does |\n| --- | --- |\n| `dev` | runs |\n'),
    ).toBe(
      '<table>\n<thead><tr><th>Command</th><th>Does</th></tr></thead>\n' +
        '<tbody>\n<tr><td><code>dev</code></td><td>runs</td></tr>\n</tbody>\n</table>',
    );
  });

  test('markup in prose is escaped, so a document cannot inject any', () => {
    expect(renderMarkdown('A <script>alert(1)</script> line\n')).toBe(
      '<p>A &lt;script&gt;alert(1)&lt;/script&gt; line</p>',
    );
  });

  test('a link inside a table cell still renders', () => {
    expect(renderMarkdown('| A |\n| --- |\n| [x](./y.md) |\n')).toContain(
      '<a href="./y.md">x</a>',
    );
  });
});
