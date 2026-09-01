import { join, relative, sep } from 'node:path';

import type { AppTarget } from '../runtime/config';
import { readTextFile } from '../sdk/io';
import type { ScaffoldFile } from './scaffold';

/**
 * A starting point `fsx init --template=<name>` copies.
 *
 * The sources are real `.tsx` files in this package, not strings in code:
 * they are typechecked, transpiled and analysed by the suite like any other
 * source, so a template cannot describe an app that does not compile. What
 * cannot be read off those files — which platform the app is for, and the
 * pub packages it needs — is declared here, and a gate checks the two agree.
 */
export interface TemplateMeta {
  target: AppTarget;
  /** Platforms `flutter create` is asked for; the target's own by default. */
  platforms?: readonly AppTarget[];
  /** One line, shown by `fsx init --help`. */
  blurb: string;
  /** Pub packages the sources import, at the version they were proven with. */
  plugins: Readonly<Record<string, string>>;
}

export interface Template extends TemplateMeta {
  name: string;
  sources: ScaffoldFile[];
}

/** What each template shows off, for its README and the docs. */
export const TEMPLATE_FEATURES: Readonly<Record<string, readonly string[]>> = {
  web: [
    'Routes — `createRouter` and `useNavigation().push(…)`, wired into the app for you',
    'A store every page reads, with `useStore`',
    'Models generated from TypeScript interfaces',
    'Module data: `export const ALBUMS: Album[]`',
    'Helpers with real bodies, called from the tree',
  ],
  mobile: [
    'Tabs — `<TabView>` becomes a Scaffold with an IndexedStack',
    'A live camera preview: the plugin’s own widget, rendered in TSX',
    'A bottom sheet from a handler',
    'The keychain, read with `useAsync` and written from a handler',
    'A store shared by all three tabs',
  ],
  desktop: [
    'A master–detail window: a filtered sidebar and a details pane',
    'A store the two panes share',
    'Live build information from `usePackageInfo`',
    'Opening links with `launchUrl`',
    'An `<Animated>` panel and colours written as `#rrggbb`',
  ],
  tray: [
    'Tray events: writing a callback registers the listener for you',
    'A live connectivity stream with `useStream`',
    'A mount effect that talks to the plugin',
    'A store the tray and the window share',
    'Opening links with `launchUrl`',
  ],
};

export const TEMPLATES: Readonly<Record<string, TemplateMeta>> = {
  web: {
    target: 'web',
    blurb:
      'An album browser: routes, a store every page reads, models and helpers.',
    plugins: { go_router: '^18.0.0' },
  },
  mobile: {
    target: 'ios',
    platforms: ['ios', 'android'],
    blurb:
      'A field-notes app: tabs, a live camera preview, a sheet, and the keychain.',
    plugins: {
      camera: '^0.12.0',
      flutter_secure_storage: '^9.2.4',
    },
  },
  desktop: {
    target: 'macos',
    blurb:
      'A service console: a filtered sidebar, a details pane, and live build info.',
    plugins: {
      package_info_plus: '^8.3.1',
      url_launcher: '^6.3.2',
    },
  },
  tray: {
    target: 'macos',
    blurb:
      'A menu-bar companion: tray events, a live connectivity stream, and a status window.',
    plugins: {
      connectivity_plus: '^7.3.1',
      tray_manager: '^0.5.3',
      url_launcher: '^6.3.2',
    },
  },
};

export const TEMPLATE_NAMES: readonly string[] = Object.keys(TEMPLATES).sort();

const templatesDir = new URL('../../templates/', import.meta.url).pathname;

/** The directory a template's sources are read from. */
export const templateDir = (name: string): string => join(templatesDir, name);

/**
 * A template with its sources, read from this package.
 *
 * Paths are returned with forward slashes because they name entries in a
 * project being written, not paths on the machine reading the template.
 */
export const loadTemplate = async (
  name: string,
  readFile: (path: string) => Promise<string | null> = readTextFile,
): Promise<Template> => {
  const meta = TEMPLATES[name];
  if (meta === undefined) {
    throw new Error(
      `unknown template \`${name}\` — available: ${TEMPLATE_NAMES.join(', ')}.`,
    );
  }
  const directory = templateDir(name);
  const paths = (
    await Array.fromAsync(new Bun.Glob('**/*').scan({ cwd: directory }))
  ).sort();
  const sources = await Promise.all(
    paths.map(async (path): Promise<ScaffoldFile> => {
      const filePath = join(directory, path);
      const contents = await readFile(filePath);
      if (contents === null) {
        throw new Error(`template file is unreadable: ${filePath}.`);
      }
      return { path: relative('.', path).split(sep).join('/'), contents };
    }),
  );
  return { name, ...meta, sources };
};
