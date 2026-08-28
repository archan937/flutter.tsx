/** Platforms a project can build for. */
export type AppTarget = 'web' | 'ios' | 'android';

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
