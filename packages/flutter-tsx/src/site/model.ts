export interface SiteProp {
  tsxProp: string;
  tsType: string;
  dartType: string;
  required: boolean;
}

export interface SiteWidget {
  name: string;
  library: string;
  doc: string;
  props: SiteProp[];
  tsxExample: string;
  exampleComplete: boolean;
  dartSignature: string;
}

export interface SiteEnum {
  name: string;
  library: string;
  doc: string;
  values: string[];
}

/** One option a plugin hook accepts, and what omitting it means. */
export interface SitePluginOption {
  name: string;
  type: string;
  values: string[];
  // null when omitting the option keeps the plugin's own first choice, which
  // a supplier filter does — there is no default member to name.
  defaultValue: string | null;
}

export interface SitePluginHook {
  name: string;
  signature: string;
  /** Lifecycle calls the generated widget makes, so the developer never does. */
  manages: string[];
  options: SitePluginOption[];
}

/** Something the host app must declare for a plugin to work on a platform. */
export interface SitePluginRequirement {
  platform: 'Android' | 'iOS';
  kind: string;
  values: string[];
}

export interface SitePlugin {
  package: string;
  version: string;
  module: string;
  hooks: SitePluginHook[];
  /** The generated declaration — the exact typings the IDE reads. */
  declaration: string;
  requirements: SitePluginRequirement[];
  /** Certified fixtures importing this plugin; never empty. */
  examples: SiteExample[];
}

export interface SiteExample {
  id: string;
  title: string;
  tsx: string;
  dart: string;
}

export type SiteCoreKind = 'hook' | 'function' | 'component' | 'type';

/** One export of the runtime core, as its own declaration spells it. */
export interface SiteCoreEntry {
  name: string;
  kind: SiteCoreKind;
  signature: string;
  doc: string;
  /** Fixture ids exercising it; never empty for a value. */
  examples: string[];
}

/** A value type a prop accepts, as the generated declarations spell it. */
export interface SiteType {
  name: string;
  /** The Flutter type it stands for: `ColorValue` is a `Color`. */
  dartType: string;
  /** The declared union of everything the prop accepts. */
  accepts: string;
  /** The object form's declaration, when the type has one. */
  shape: string | null;
  doc: string;
  usedBy: string[];
}

export interface SitePage {
  flutterVersion: string;
  /** The worked example the reference opens with. */
  example: SiteExample;
  coreApi: SiteCoreEntry[];
  widgets: SiteWidget[];
  types: SiteType[];
  enums: SiteEnum[];
  plugins: SitePlugin[];
  incompleteExamples: string[];
}
