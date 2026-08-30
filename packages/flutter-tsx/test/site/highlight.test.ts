import { describe, expect, test } from 'bun:test';

import { loadRecipes } from '@src/site/cookbook';
import { codeBlock, highlight } from '@src/site/highlight';

const stripTags = (html: string): string => html.replace(/<[^>]+>/g, '');

const unescape = (html: string): string =>
  html
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');

describe('highlight', () => {
  test('colours keywords, types, calls, strings, numbers and comments', () => {
    expect(highlight("// hi\nconst n = fn(1, 'a', Text);", 'tsx')).toBe(
      '<span class="tok-com">// hi</span>\n' +
        '<span class="tok-kw">const</span> n = ' +
        '<span class="tok-fn">fn</span>(<span class="tok-num">1</span>, ' +
        '<span class="tok-str">\'a\'</span>, ' +
        '<span class="tok-typ">Text</span>);',
    );
  });

  test('leaves a keyword inside a string alone', () => {
    expect(highlight("'const'", 'tsx')).toBe(
      '<span class="tok-str">\'const\'</span>',
    );
  });

  test('knows the keywords each language actually has', () => {
    // `final` and `mixin` are Dart's; `function` is TypeScript's.
    expect(highlight('final', 'dart')).toContain('tok-kw');
    expect(highlight('mixin', 'dart')).toContain('tok-kw');
    expect(highlight('mixin', 'tsx')).not.toContain('tok-kw');
    expect(highlight('function', 'tsx')).toContain('tok-kw');
  });

  test('escapes markup so code can never inject any', () => {
    expect(highlight('<Text a="1 & 2">', 'tsx')).toBe(
      '&lt;<span class="tok-typ">Text</span> a=' +
        '<span class="tok-str">&quot;1 &amp; 2&quot;</span>&gt;',
    );
  });

  test('handles a Dart raw string and an interpolated one', () => {
    expect(highlight("r'a\\b'", 'dart')).toContain('tok-str');
    expect(highlight("'v${x}'", 'dart')).toBe(
      '<span class="tok-str">\'v${x}\'</span>',
    );
  });
});

describe('highlight — JSX', () => {
  test('leaves the words a component renders as prose', () => {
    // Without this they colour as types: a lexer cannot otherwise tell
    // `Content` in <Text>Content</Text> from a component name.
    expect(highlight('<Text>Take Photo</Text>', 'tsx')).toBe(
      '&lt;<span class="tok-typ">Text</span>&gt;Take Photo&lt;/' +
        '<span class="tok-typ">Text</span>&gt;',
    );
  });

  test('still colours an expression embedded in that text', () => {
    expect(highlight('<Text>{Colors.red}</Text>', 'tsx')).toContain(
      '{<span class="tok-typ">Colors</span>.red}',
    );
  });

  test('does not treat a comparison or an arrow as a tag', () => {
    expect(highlight('a > b ? Foo : Bar', 'tsx')).toBe(
      'a &gt; b ? <span class="tok-typ">Foo</span> : ' +
        '<span class="tok-typ">Bar</span>',
    );
  });
});

describe('highlighting never changes the code', () => {
  test('every fixture survives both languages unchanged', async () => {
    const recipes = await loadRecipes(
      new URL('../fixtures', import.meta.url).pathname,
    );
    expect(recipes.length).toBeGreaterThan(30);

    for (const recipe of recipes) {
      expect(unescape(stripTags(highlight(recipe.tsx, 'tsx')))).toBe(
        recipe.tsx,
      );
      expect(unescape(stripTags(highlight(recipe.dart, 'dart')))).toBe(
        recipe.dart,
      );
    }
  }, 60000);
});

describe('codeBlock', () => {
  test('wraps highlighted code in a language-tagged block', () => {
    expect(codeBlock('const a = 1;\n', 'tsx')).toBe(
      '<pre><code class="language-tsx">' +
        '<span class="tok-kw">const</span> a = ' +
        '<span class="tok-num">1</span>;</code></pre>',
    );
  });
});
