import { describe, expect, test } from 'bun:test';

import type { SitePage, SiteWidget } from '@src/site/model';
import {
  buildApiReferenceHtml,
  cleanDoc,
  enumSection,
  escapeHtml,
  navHtml,
  propTable,
  widgetSection,
} from '@src/site/render';

const frame: SiteWidget = {
  name: 'Frame',
  library: 'widgets',
  doc: '/// A frame around a child.\n///\n/// Second paragraph.',
  props: [
    {
      tsxProp: 'children',
      tsType: 'FlutterChild',
      dartType: 'Widget?',
      required: false,
    },
    { tsxProp: 'color', tsType: 'Color', dartType: 'Color?', required: true },
  ],
  tsxExample: '<Frame color={Colors.blue}>\n  <Text>Content</Text>\n</Frame>',
  exampleComplete: true,
  dartSignature: 'Frame({\n  Key? key,\n  Widget? child,\n  Color? color,\n})',
};

const page: SitePage = {
  flutterVersion: '3.47.1',
  widgets: [frame],
  enums: [
    {
      name: 'TestAlign',
      library: 'painting',
      doc: '/// How to align.',
      values: ['start', 'end'],
    },
  ],
  incompleteExamples: [],
};

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
<pre><code class="language-tsx">&lt;Frame color={Colors.blue}&gt;
  &lt;Text&gt;Content&lt;/Text&gt;
&lt;/Frame&gt;</code></pre>
</div>
<div class="tab-panel" data-panel="dart" role="tabpanel">
<pre><code class="language-dart">Frame({
  Key? key,
  Widget? child,
  Color? color,
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
<pre><code class="language-typescript">"start" | "end"</code></pre>
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
    const incomplete = { ...frame, exampleComplete: false };
    expect(widgetSection(incomplete)).not.toBe(widgetSection(frame));
    expect(widgetSection(incomplete)).toBe(
      widgetSection(frame).replace(
        '<a class="badge badge-pkg" href="#verification">✓ typechecked</a>',
        '',
      ),
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
