import { describe, expect, test } from 'bun:test';

import {
  buildApiReferenceHtml,
  cleanDoc,
  coreApiSection,
  enumSection,
  escapeHtml,
  navHtml,
  pluginSection,
  propTable,
  widgetSection,
} from '@src/site/render';
import { frame, page } from '@test/support/sample-page';

describe('escapeHtml', () => {
  test('escapes markup characters', () => {
    expect(escapeHtml('<Text a="1 & 2">')).toBe(
      '&lt;Text a=&quot;1 &amp; 2&quot;&gt;',
    );
  });
});

describe('cleanDoc', () => {
  test('strips doc markers and keeps paragraphs', () => {
    expect(cleanDoc('/// One.\n///\n/// Two.')).toBe('One.\n\nTwo.');
  });

  test('keeps only the first paragraph when asked', () => {
    expect(
      cleanDoc('/// One.\n///\n/// Two.', { firstParagraphOnly: true }),
    ).toBe('One.');
  });

  test('returns empty for empty docs', () => {
    expect(cleanDoc('')).toBe('');
  });
});

describe('propTable', () => {
  test('is empty without props', () => {
    expect(propTable([])).toBe('');
  });

  test('renders the complete table', () => {
    expect(propTable(frame.props)).toBe(
      `<table class="props">
<thead><tr><th>Prop</th><th>TSX type</th><th>Dart type</th><th>Required</th></tr></thead>
<tbody>
<tr><td>children</td><td>FlutterChild</td><td>Widget?</td><td class="req"></td></tr>
<tr><td>color</td><td>Color</td><td>Color?</td><td class="req">✓</td></tr>
</tbody>
</table>`,
    );
  });
});

describe('widgetSection', () => {
  test('renders the complete card', () => {
    expect(widgetSection(frame)).toBe(
      `<article class="widget" id="Frame" data-name="Frame">
<h3>Frame<span class="badge badge-lib">widgets</span><a class="badge badge-pkg" href="#verification">✓ typechecked</a></h3>
<p class="doc">A frame around a child.</p>
<table class="props">
<thead><tr><th>Prop</th><th>TSX type</th><th>Dart type</th><th>Required</th></tr></thead>
<tbody>
<tr><td>children</td><td>FlutterChild</td><td>Widget?</td><td class="req"></td></tr>
<tr><td>color</td><td>Color</td><td>Color?</td><td class="req">✓</td></tr>
</tbody>
</table>

<div class="tabs">
<div class="tab-btns" role="tablist">
<button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
<button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart constructor</button>
</div>
<div class="tab-panel active" data-panel="tsx" role="tabpanel">
<pre><code class="language-tsx">&lt;<span class="tok-typ">Frame</span> color={<span class="tok-typ">Colors</span>.blue}&gt;
  &lt;<span class="tok-typ">Text</span>&gt;Content&lt;/<span class="tok-typ">Text</span>&gt;
&lt;/<span class="tok-typ">Frame</span>&gt;</code></pre>
</div>
<div class="tab-panel" data-panel="dart" role="tabpanel">
<pre><code class="language-dart"><span class="tok-typ">Frame</span>({
  <span class="tok-typ">Key</span>? key,
  <span class="tok-typ">Widget</span>? child,
  <span class="tok-typ">Color</span>? color,
})</code></pre>
</div>
</div>
</article>`,
    );
  });
});

describe('enumSection', () => {
  test('renders the complete entry', () => {
    const [firstEnum] = page.enums;
    if (firstEnum === undefined) {
      throw new Error('fixture page must contain an enum');
    }
    expect(enumSection(firstEnum)).toBe(
      `<article class="widget enum-entry" id="TestAlign" data-name="TestAlign">
<h3>TestAlign<span class="badge badge-lib">painting</span></h3>
<div class="tabs">
<div class="tab-btns" role="tablist">
<button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
<button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
</div>
<div class="tab-panel active" data-panel="tsx" role="tabpanel">
<pre><code class="language-typescript"><span class="tok-str">'start'</span> | <span class="tok-str">'end'</span></code></pre>
</div>
<div class="tab-panel" data-panel="dart" role="tabpanel">
<ul class="enum-values"><li><code>TestAlign.start</code></li>
<li><code>TestAlign.end</code></li></ul>
</div>
</div>
</article>`,
    );
  });
});

describe('navHtml', () => {
  test('groups widgets by library with counts', () => {
    expect(navHtml(page)).toBe(
      `<details open>
<summary>Examples<span class="nav-count">1</span></summary>
<ul>
<li data-name="Camera"><a href="#example-01-camera-screen">Camera</a></li>
</ul>
</details>
<details>
<summary>Hooks &amp; core APIs<span class="nav-count">1</span></summary>
<ul>
<li data-name="useState"><a href="#core-useState">useState</a></li>
</ul>
</details>
<details open>
<summary>Widgets<span class="nav-count">1</span></summary>
<ul></ul>
<details>
<summary>widgets<span class="nav-count">1</span></summary>
<ul>
<li data-name="Frame"><a href="#Frame">Frame</a></li>
</ul>
</details>
</details>
<details>
<summary>Native plugins<span class="nav-count">1</span></summary>
<ul>
<li data-name="camera"><a href="#plugin-camera">camera</a></li>
</ul>
</details>
<details>
<summary>Types<span class="nav-count">1</span></summary>
<ul>
<li data-name="ColorValue"><a href="#type-ColorValue">ColorValue</a></li>
</ul>
</details>
<details>
<summary>Enums<span class="nav-count">1</span></summary>
<ul>
<li data-name="TestAlign"><a href="#TestAlign">TestAlign</a></li>
</ul>
</details>`,
    );
  });
});

describe('widgetSection without a verified example', () => {
  test('carries no badge', () => {
    const incomplete = {
      ...frame,
      example: { ...frame.example, complete: false },
    };
    expect(widgetSection(incomplete)).not.toBe(widgetSection(frame));
    expect(widgetSection(incomplete)).toBe(
      widgetSection(frame).replace(
        '<a class="badge badge-pkg" href="#verification">✓ typechecked</a>',
        '',
      ),
    );
  });
});

describe('the verification section', () => {
  test('names how many examples carry the badge, from the page', () => {
    const html = buildApiReferenceHtml(page);

    expect(html).toContain(
      `<strong>${page.widgets.length} of the ${page.widgets.length} widgets documented here carry it</strong>`,
    );
  });

  test('counts an example that could not be written as not carrying it', () => {
    const html = buildApiReferenceHtml({
      ...page,
      incompleteExamples: [frame.name],
    });

    expect(html).toContain('<strong>0 of the 1 widgets documented here');
  });
});

describe('coreApiSection', () => {
  const entry = {
    name: 'json',
    kind: 'function' as const,
    signature: '(body: string) => unknown',
    doc: 'Decodes a body:\n\n```tsx\nconst album = json(body) as Album;\n```\n\nThe cast names the `Album` model.',
    examples: [],
    usage: null,
  };

  test('renders a fenced example as code, and the prose around it', () => {
    const html = coreApiSection(entry);

    expect(html).toContain('<p class="doc">Decodes a body:</p>');
    expect(html).toContain('<pre><code class="language-tsx">');
    expect(html).toContain('names the <code>Album</code> model.</p>');
    // The fence itself is markup, not content: it never reaches the page.
    expect(html).not.toContain('```');
  });

  test('a doc that is only an example is only a code block', () => {
    const html = coreApiSection({
      ...entry,
      doc: '```tsx\nconst album = json(body) as Album;\n```',
    });

    expect(html).toContain('<pre><code class="language-tsx">');
    expect(html).not.toContain('<p class="doc">');
  });

  test('a declaration with no doc renders none', () => {
    expect(coreApiSection({ ...entry, doc: '' })).not.toContain('class="doc"');
  });
});

describe('widgetSection with a value it could not write', () => {
  test('says which prop it is, its type, and why', () => {
    // Nothing on this page needs it today — the boundary test proves the
    // reference has no such widget — and the note stays here because a
    // future SDK shape has to be reported, never left as a placeholder.
    const unwritten = {
      ...frame,
      example: {
        ...frame.example,
        complete: false,
        unwritable: [
          {
            prop: 'view',
            type: 'FlutterView',
            reason: 'supplied-by-flutter' as const,
          },
        ],
      },
    };

    expect(widgetSection(unwritten)).toContain(
      '<p class="note"><code>view</code> (FlutterView) — ',
    );
  });
});

describe('pluginSection', () => {
  test('refuses a plugin that reached the page without an example', () => {
    const [plugin] = page.plugins;
    if (plugin === undefined)
      throw new Error('the sample page lost its plugin');

    expect(() => pluginSection({ ...plugin, examples: [] })).toThrow(
      'plugin camera reached the page unproven.',
    );
  });
});

describe('buildApiReferenceHtml', () => {
  test('matches the committed page fixture byte for byte', async () => {
    const fixture = await Bun.file(
      new URL('__fixtures__/api-reference-page.html', import.meta.url),
    ).text();

    expect(buildApiReferenceHtml(page)).toBe(fixture);
  });
});
