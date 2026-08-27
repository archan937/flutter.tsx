import type { HookOverrides } from './hooks';

// Tier-3 judgment deltas: the few facts no analyzer can derive from a
// plugin's source — sensible defaults a senior Flutter developer would pick.
export const PLUGIN_OVERRIDES: Record<string, Record<string, HookOverrides>> = {
  camera: {
    useCamera: {
      enumDefaults: { ResolutionPreset: 'high' },
      optionNames: { resolutionPreset: 'resolution', lensDirection: 'lens' },
    },
  },
};
