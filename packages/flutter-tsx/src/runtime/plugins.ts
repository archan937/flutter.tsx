// Plugin hook surface. Codegen (pubspec + permission injection + method
// rewriting) lands at roadmap steps 22–24; until a plugin's end-to-end proof
// is green it is not "supported" — this is the typed conformance target.

export interface CameraPicture {
  readonly path: string;
}

export interface CameraController {
  takePicture(): Promise<CameraPicture | null>;
}

export const useCamera = (): CameraController => ({
  takePicture: () => Promise.resolve(null),
});
