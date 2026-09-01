/**
 * Platforms a project can build for, sorted so every list of them reads the
 * same. The type is derived from this, so there is one place to add one.
 */
export const APP_TARGETS = [
  'android',
  'ios',
  'linux',
  'macos',
  'web',
  'windows',
] as const;

export type AppTarget = (typeof APP_TARGETS)[number];

export const isAppTarget = (value: unknown): value is AppTarget =>
  typeof value === 'string' &&
  APP_TARGETS.includes(value as (typeof APP_TARGETS)[number]);

/**
 * A project's `fsx.config.ts`. Written with `satisfies AppConfig` so the
 * literal types survive and the IDE completes every field.
 */
export interface AppConfig {
  /** Dart package name: lower_snake_case. */
  name: string;
  /** Reverse-DNS application id, e.g. `dev.fluttertsx.myapp`. */
  bundleId: string;
  /** Platform `fsx dev` and `fsx build` target by default. */
  target: AppTarget;
}
