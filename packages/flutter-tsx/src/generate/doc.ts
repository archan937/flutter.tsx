const MACRO_ONLY_LINE =
  /^\{@(tool|end-tool|animation|template|endtemplate|macro|youtube|inject-html)[^}]*\}$/;

export const dartdocToJsdoc = (dartdoc: string, indent: string): string => {
  if (dartdoc === '') {
    return '';
  }

  const lines = dartdoc
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/\/ ?/, ''))
    .filter((line) => !MACRO_ONLY_LINE.test(line.trim()))
    .map((line) => line.replaceAll('*/', '*\\/'));

  while (lines.length > 0 && lines[0]?.trim() === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines.at(-1)?.trim() === '') {
    lines.pop();
  }
  if (lines.length === 0) {
    return '';
  }

  const body = lines.map((line) =>
    line === '' ? `${indent} *` : `${indent} * ${line}`,
  );
  return [`${indent}/**`, ...body, `${indent} */`].join('\n');
};
