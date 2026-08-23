import { describe, expect, test } from 'bun:test';

import { useCamera } from '@src/runtime/plugins';

describe('useCamera (compile-target stub)', () => {
  test('returns an inert controller', async () => {
    const camera = useCamera();

    expect(await camera.takePicture()).toBeNull();
  });
});
