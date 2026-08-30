/**
 * Every limitation the compiler still refuses, read out of the compiler.
 *
 * Two of these messages once pointed at roadmap steps that had already
 * shipped, and nothing noticed until it was asked about by hand. A gap is
 * only honest while what it says about itself is true, so the messages are
 * swept mechanically: one that promises a completed step, or a limitation
 * the site never mentions, fails the build.
 */
export interface Deferral {
  code: string;
  message: string;
  /** Where it is raised, relative to the package. */
  source: string;
}

// `throw tsxErrorAt('TSX0305', 'message' + 'continued', {` — the message is a
// run of adjacent string literals, which is how a long one is written here.
// A message literal may escape the delimiter it is written in — a template
// literal quoting Dart code does exactly that — so an escape is consumed as
// one unit rather than ending the literal.
const LITERAL = String.raw`(?:\`(?:\\.|[^\`\\])*\`|'(?:\\.|[^'\\])*')`;

const RAISE = new RegExp(
  String.raw`tsxErrorAt\(\s*'(TSX\d{4})',\s*(${LITERAL}(?:\s*\+\s*${LITERAL})*)`,
  'g',
);

const STRING_PIECE = new RegExp(
  String.raw`\`((?:\\.|[^\`\\])*)\`|'((?:\\.|[^'\\])*)'`,
  'g',
);

/** Interpolations are the offending source text, shown as `…` in a summary. */
const messageOf = (literal: string): string =>
  [...literal.matchAll(STRING_PIECE)]
    .map((piece) => piece[1] ?? piece[2] ?? '')
    .join('')
    .replace(/\$\{[^}]*\}/g, '…')
    .replaceAll('\\`', '`')
    .trim();

// A limitation, as opposed to a rejection of code that is simply wrong: it
// says the compiler does not do this, not that the developer erred.
const LIMITATION =
  /cannot resolve|does not translate|not compiled|only .* can be|is not in scope|land[s]? (with|at)|yet\b/;

export const extractDeferrals = (
  sources: { path: string; text: string }[],
): Deferral[] => {
  const found: Deferral[] = [];
  for (const source of sources) {
    for (const raise of source.text.matchAll(RAISE)) {
      const message = messageOf(raise[2] ?? '');
      if (!LIMITATION.test(message)) continue;
      found.push({
        code: raise[1] ?? '',
        message,
        source: source.path,
      });
    }
  }
  return found.sort(
    (first, second) =>
      first.code.localeCompare(second.code) ||
      first.message.localeCompare(second.message),
  );
};

const ROADMAP_STEP = /roadmap step (\d+)|step (\d+)\)/;

/**
 * A message may not send a developer to wait for a step that already shipped.
 * `completed` holds the roadmap numbers checked off, so this catches exactly
 * the drift that went unnoticed before.
 */
export const staleDeferrals = (
  deferrals: Deferral[],
  completed: ReadonlySet<string>,
): Deferral[] =>
  deferrals.filter((deferral) => {
    const cited = ROADMAP_STEP.exec(deferral.message);
    const step = cited?.[1] ?? cited?.[2];
    return step !== undefined && completed.has(step);
  });

const CHECKED_STEP = /^- \[x\] (\d+)/gm;

/** The roadmap steps marked done, from the roadmap itself. */
export const completedSteps = (roadmap: string): Set<string> =>
  new Set([...roadmap.matchAll(CHECKED_STEP)].map((match) => match[1] ?? ''));
