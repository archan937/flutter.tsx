import { writeExamples } from '@src/cli/examples';
import { TEMPLATE_NAMES } from '@src/cli/templates';

const written = await writeExamples();
process.stdout.write(
  `Wrote ${written.length} files into examples/ from ` +
    `${TEMPLATE_NAMES.length} templates.\n`,
);
