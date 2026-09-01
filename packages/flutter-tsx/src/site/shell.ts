import { escapeHtml } from './render';

/**
 * The chrome every page of the site shares: palette, layout, and the sticky
 * sidebar with its search, accordion groups and scroll-spy.
 *
 * It lived only in the API reference, so the cookbook and guide had a lesser
 * sidebar of their own — two navigations, one of them worse, for one site.
 * Both now render this one.
 */

/** One collapsible group of links in the sidebar. */
export interface NavGroup {
  title: string;
  open?: boolean;
  items: { id: string; label: string }[];
}

/** Every page of the site, in the order the nav lists them. */
export type SitePageId =
  'home' | 'guide' | 'cookbook' | 'examples' | 'api' | 'config';

interface SiteLink {
  id: SitePageId;
  href: string;
  label: string;
}

/**
 * The one main navigation, identical on every page.
 *
 * Each page used to list a different subset of its siblings — the API
 * reference listed none of them, so the largest page on the site was a dead
 * end. Every page now offers the whole site and marks where the reader is.
 */
const SITE_LINKS: readonly SiteLink[] = [
  { id: 'home', href: './index.html', label: 'Home' },
  { id: 'guide', href: './guide.html', label: 'Guide' },
  { id: 'cookbook', href: './cookbook.html', label: 'Cookbook' },
  { id: 'examples', href: './examples.html', label: 'Examples' },
  { id: 'api', href: './api-reference.html', label: 'API reference' },
  { id: 'config', href: './config-mapping.html', label: 'Config mapping' },
];

export interface ShellOptions {
  /** Shown under the search box, e.g. “37 recipes · 7 categories”. */
  meta: string;
  /** Placeholder for the filter input. */
  searchPlaceholder: string;
  /** The page being rendered, which the nav marks rather than links. */
  current: SitePageId;
}

const GITHUB = 'https://github.com/archan937/flutter.tsx';

const mainNav = (current: SitePageId): string =>
  `<nav class="site-nav" aria-label="Site">
${SITE_LINKS.map((link) =>
  link.id === current
    ? `    <span class="here" aria-current="page">${escapeHtml(link.label)}</span>`
    : `    <a href="${link.href}">${escapeHtml(link.label)}</a>`,
).join('\n')}
    <a class="ghstars" href="${GITHUB}/stargazers" target="_blank" rel="noopener" aria-label="Star flutter.tsx on GitHub"><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 .25l2.06 4.17 4.6.67-3.33 3.24.79 4.59L8 11.42l-4.12 2.16.79-4.59L1.34 5.09l4.6-.67z" /></svg><span id="gh-stars">Star</span></a>
    <a href="${GITHUB}" target="_blank" rel="noopener">GitHub ↗</a>
  </nav>`;

const navGroup = (group: NavGroup): string =>
  `<details${group.open === true ? ' open' : ''}>
<summary>${escapeHtml(group.title)}<span class="nav-count">${group.items.length}</span></summary>
<ul>
${group.items
  .map(
    (item) =>
      `<li data-name="${escapeHtml(item.label)}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.label)}</a></li>`,
  )
  .join('\n')}
</ul>
</details>`;

/** The sidebar itself, identical in structure on every page. */
export const sidebarHtml = (
  options: ShellOptions,
  navHtml: string,
): string => `<aside id="sidebar">
  <a class="sb-brand" href="./index.html"><img class="mark" src="./icon.png" alt="flutter.tsx logo" width="28" height="28"><span>flutter<b>.tsx</b></span></a>
  ${mainNav(options.current)}
  <input id="search" type="search" placeholder="${escapeHtml(options.searchPlaceholder)}" autocomplete="off" spellcheck="false">
  <div class="meta-info">${escapeHtml(options.meta)}</div>
  <nav id="sidebar-nav">
${navHtml}
  </nav>
</aside>`;

export const navGroupsHtml = (groups: NavGroup[]): string =>
  groups.map(navGroup).join('\n');

/** The tabbed pane every page shows code in — never two panes side by side. */
export const TABS_CSS = `
.tabs { margin-top: 14px; border: 1px solid var(--line); border-radius: 11px; overflow: hidden; background: rgba(7,9,15,.5); }
.tab-btns { display: flex; flex-wrap: wrap; background: rgba(255,255,255,.02); border-bottom: 1px solid var(--line); }
.tab-btn { background: none; border: none; border-bottom: 2px solid transparent;
  margin-bottom: -1px; padding: 9px 18px; cursor: pointer; font-family: var(--mono); font-size: 12px; font-weight: 600;
  color: var(--muted); transition: color .15s; letter-spacing: .04em; }
.tab-btn:hover { color: var(--text); }
.tab-btn.active { color: var(--react); border-bottom-color: var(--react); }
.tab-panel { display: none; }
.tab-panel.active { display: block; }
`;

/** Switches the tabbed panes, by delegation, so one listener serves them all. */
export const TABS_JS = `
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tabs = btn.closest('.tabs');
    if (!tabs) return;
    const tab = btn.dataset.tab;
    tabs.querySelectorAll('.tab-btn').forEach(function (b) {
      const active = b.dataset.tab === tab;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    tabs.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.dataset.panel === tab);
    });
  });
`;

export const NAV_CSS = `
.site-nav { display: flex; flex-direction: column; gap: 1px; margin: 0 0 14px; }
.site-nav a, .site-nav .here {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 7px;
  font-size: 12.5px; font-weight: 600; text-decoration: none; color: var(--muted);
  transition: background .12s, color .12s; }
.site-nav a:hover { background: rgba(255,255,255,.04); color: var(--text); }
.site-nav .here { color: var(--react); background: rgba(97,218,251,.12); }
.site-nav .ghstars { margin-top: 6px; border-top: 1px solid var(--line-soft); padding-top: 9px; }
.site-nav .ghstars svg { color: var(--amber, #f5d761); }
`;

export const SHELL_CSS = `:root {
  --react:#61dafb; --flutter:#54a4ff; --violet:#a78bfa;
  --bg:#07090f; --panel:rgba(20,26,38,.62);
  --line:rgba(120,150,200,.16); --line-soft:rgba(120,150,200,.09);
  --text:#e8eef7; --muted:#9aa6bb; --dim:#6f7c93;
  --grad:linear-gradient(115deg,#61dafb 0%,#54a4ff 48%,#a78bfa 100%);
  --display:"Bricolage Grotesque",system-ui,sans-serif;
  --body:"Hanken Grotesk",system-ui,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,"SF Mono",monospace;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; }
body { display: flex; font-family: var(--body); color: var(--text); line-height: 1.6;
  background: var(--bg); min-height: 100vh; -webkit-font-smoothing: antialiased; }

/* ── Atmosphere ─── */
.bg-layer { position: fixed; inset: 0; z-index: -2; pointer-events: none; }
.bg-grid { background-image:
    linear-gradient(var(--line-soft) 1px, transparent 1px),
    linear-gradient(90deg, var(--line-soft) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 78%);
  -webkit-mask-image: radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 78%); }
.bg-glow { background:
    radial-gradient(900px 520px at 50% -160px, rgba(97,218,251,.16), transparent 70%),
    radial-gradient(820px 520px at 95% 4%, rgba(167,139,250,.12), transparent 66%); }

/* ── Sidebar ─── */
#sidebar { position: sticky; top: 0; height: 100vh; overflow-y: auto;
  width: 250px; min-width: 250px; flex-shrink: 0; padding: 18px 12px 24px; font-size: 13px;
  background: linear-gradient(180deg, rgba(17,21,31,.92), rgba(11,14,20,.84));
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-right: 1px solid var(--line); }
.sb-brand { display: flex; align-items: center; gap: 10px; text-decoration: none;
  color: var(--text); font-family: var(--mono); font-weight: 700; font-size: .95rem;
  letter-spacing: -.02em; padding: 4px 6px 16px; }
.sb-brand .mark { width: 28px; height: 28px; border-radius: 7px; object-fit: cover; display: block;
  border: 1px solid rgba(97,218,251,.4); box-shadow: 0 0 9px rgba(167,139,250,.3), 0 3px 12px rgba(167,139,250,.16); }
.sb-brand b { background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
#search { width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px;
  font-family: var(--body); font-size: 13px; margin-bottom: 10px; outline: none;
  background: rgba(7,9,15,.6); color: var(--text); }
#search::placeholder { color: var(--dim); }
#search:focus { border-color: var(--flutter); box-shadow: 0 0 0 2px rgba(84,164,255,.18); }
.meta-info { font-family: var(--mono); font-size: 10.5px; color: var(--dim); margin-bottom: 12px; padding: 0 2px; }
.sb-gh { display: flex; gap: 8px; margin-bottom: 14px; }
.sb-gh a { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border: 1px solid var(--line);
  border-radius: 8px; font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--text);
  text-decoration: none; background: rgba(7,9,15,.5); transition: border-color .15s; }
.sb-gh a:hover { border-color: rgba(245,215,97,.45); }
.sb-gh a.ghstars svg { color: var(--amber); }

/* ── Sidebar accordion ─── */
details { margin-bottom: 2px; }
details > summary {
  cursor: pointer; list-style: none; display: flex; align-items: center;
  padding: 6px 8px; border-radius: 7px; font-weight: 600; color: var(--muted);
  user-select: none; gap: 6px; }
details > summary:hover { background: rgba(255,255,255,.04); color: var(--text); }
details > summary::-webkit-details-marker { display: none; }
details > summary::before {
  content: '▶'; font-size: 8px; color: var(--dim); flex-shrink: 0;
  transition: transform .18s; display: inline-block; width: 10px; }
details[open] > summary::before { transform: rotate(90deg); }
.nav-count { font-weight: 400; color: var(--dim); font-size: 11px; margin-left: auto; font-family: var(--mono); }
details > ul { list-style: none; padding: 2px 0 4px 18px; }
details > ul li { margin: 1px 0; }
details > ul li a {
  display: block; padding: 3px 8px; border-radius: 6px; color: var(--muted);
  text-decoration: none; font-size: 12px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; transition: background .12s, color .12s; }
details > ul li a:hover { background: rgba(255,255,255,.04); color: var(--text); }
details > ul li a.active { background: rgba(97,218,251,.12); color: var(--react); font-weight: 600; }

/* ── Main content ─── */
main { flex: 1; max-width: 920px; padding: 48px 56px; min-width: 0; }
h1 {
  font-family: var(--display); font-size: 36px; font-weight: 800; letter-spacing: -.03em; margin-bottom: 8px;
  background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.subtitle { color: var(--muted); margin-bottom: 40px; font-size: 15px; }
.subtitle code { font-family: var(--mono); font-size: .9em; background: rgba(255,255,255,.06); padding: .1em .4em; border-radius: 5px; color: var(--react); }
h2 { font-family: var(--display); font-size: 22px; font-weight: 700; letter-spacing: -.02em;
  margin: 56px 0 22px; padding-bottom: 10px; border-bottom: 1px solid var(--line); color: var(--text); }
h2:first-of-type { margin-top: 0; }
`;

export const SHELL_JS = `  // ── Search / filter ───────────────────────────────────────────────────────
  const searchEl = document.getElementById('search');
  const noResults = document.getElementById('no-results');
  const navDetails = Array.from(document.querySelectorAll('#sidebar-nav details'));
  const initialOpen = new Map(navDetails.map(function (d) { return [d, d.open]; }));

  searchEl.addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.widget').forEach(function (el) {
      const name = (el.dataset.name || '').toLowerCase();
      const show = !q || name.includes(q);
      el.hidden = !show;
      if (show) visible++;
    });
    if (noResults) noResults.style.display = (!q || visible > 0) ? 'none' : 'block';
    document.querySelectorAll('#sidebar-nav li[data-name]').forEach(function (li) {
      const name = (li.dataset.name || '').toLowerCase();
      li.hidden = q ? !name.includes(q) : false;
    });
    navDetails.forEach(function (d) {
      if (!q) {
        d.hidden = false;
        d.open = initialOpen.get(d) || false;
      } else {
        const hasVisible = Array.from(
          d.querySelectorAll('li[data-name]'),
        ).some(function (li) { return !li.hidden; });
        d.hidden = !hasVisible;
        if (hasVisible) d.open = true;
      }
    });
  });

  // ── Scrollspy — highlight the active sidebar link ─────────────────────────
  const anchors = Array.from(
    document.querySelectorAll('main .widget[id], main section[id]'),
  );
  const sideLinks = Array.from(document.querySelectorAll('#sidebar-nav a'));

  const onScroll = function () {
    const scrollY = window.scrollY + 100;
    let activeId = null;
    for (const el of anchors) {
      if (el.offsetTop <= scrollY) activeId = el.id;
    }
    sideLinks.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + activeId);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
`;
