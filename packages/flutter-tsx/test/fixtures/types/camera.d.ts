// Hand-written preview of the declaration `fsx` generates per project from
// the camera plugin's Dart source (roadmap step 22) — it keeps the camera
// fixture typechecking until the generator earns it.

declare module 'plugin:camera' {
  export interface CameraPicture {
    readonly path: string;
  }

  export interface CameraController {
    takePicture(): Promise<CameraPicture | null>;
  }

  export const useCamera: () => CameraController;
}
