import { describe, expect, test } from 'bun:test';

import { renderMarkdown } from '@src/site/markdown';

describe('renderMarkdown', () => {
  test('headings become heading elements', () => {
    expect(renderMarkdown('# Guide\n\n## Install\n\n### Detail\n')).toBe(
      '<h1 id="guide">Guide</h1>\n<h2 id="install">Install</h2>\n' +
        '<h3 id="detail">Detail</h3>',
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
      '<a href="./y.html">x</a>',
    );
  });
});

describe('links between the doc pages', () => {
  test('points a sibling markdown link at the page the site publishes', () => {
    // The markdown is the source GitHub renders, where `.md` is right; the
    // site renders each sibling to `.html`, where it is a raw file download.
    expect(
      renderMarkdown('See the [config mapping](./config-mapping.md).'),
    ).toBe(
      '<p>See the <a href="./config-mapping.html">config mapping</a>.</p>',
    );
  });

  test('leaves an external link alone', () => {
    expect(renderMarkdown('[pub](https://pub.dev/packages/camera)')).toBe(
      '<p><a href="https://pub.dev/packages/camera">pub</a></p>',
    );
  });

  test('leaves an anchor alone', () => {
    expect(renderMarkdown('[top](#top)')).toBe('<p><a href="#top">top</a></p>');
  });
});

describe('heading anchors', () => {
  test('slugs a numbered heading with code in it', () => {
    // The sidebar links to these, so they have to be stable and readable.
    expect(renderMarkdown('## 2. Install the `fsx` SDK')).toBe(
      '<h2 id="2-install-the-fsx-sdk">2. Install the <code>fsx</code> SDK</h2>',
    );
  });
});
