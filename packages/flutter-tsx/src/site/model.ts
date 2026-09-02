import type { SynthesizedExample } from './synthesize';

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
  example: SynthesizedExample;
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

/**
 * A platform declaration a plugin brings with it.
 *
 * `duty` is what the host app actually has to do about it, which differs by
 * kind: Gradle merges a plugin's own permissions on its own, an iOS usage
 * description must be written by hand with a purpose string Apple reviews,
 * and a query scheme only applies to an app that looks those URLs up.
 */
export interface SitePluginRequirement {
  platform: 'Android' | 'iOS';
  kind: string;
  values: string[];
  duty: 'merged' | 'required' | 'conditional';
}

/** A top-level function the plugin exports, imported from the same module. */
export interface SitePluginFunction {
  name: string;
  signature: string;
  doc: string;
}

export interface SitePlugin {
  package: string;
  version: string;
  module: string;
  hooks: SitePluginHook[];
  functions: SitePluginFunction[];
  /** The generated declaration — the exact typings the IDE reads. */
  declaration: string;
  requirements: SitePluginRequirement[];
  /** Certified fixtures importing this plugin; never empty. */
  examples: SiteExample[];
}

export interface SiteExample {
  id: string;
  title: string;
  /** The capability it leads with, e.g. “Async data”. */
  label: string;
  /** One line on what it shows; empty when the example carries none. */
  blurb: string;
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
  /**
   * The shortest of those fixtures, shown in full. A signature alone tells a
   * newcomer what a hook takes, not what writing one looks like.
   */
  usage: SiteExample | null;
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
  /** The worked examples the reference opens with. */
  examples: SiteExample[];
  coreApi: SiteCoreEntry[];
  widgets: SiteWidget[];
  types: SiteType[];
  enums: SiteEnum[];
  plugins: SitePlugin[];
  incompleteExamples: string[];
}
