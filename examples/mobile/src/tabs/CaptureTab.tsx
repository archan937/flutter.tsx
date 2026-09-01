import {
  AspectRatio,
  Center,
  Column,
  ElevatedButton,
  Expanded,
  Padding,
  Text,
  useStore,
} from 'flutter-tsx';
import { CameraPreview, useCamera } from 'plugin:camera';

import { notebookStore } from '../stores/notebook';

/**
 * The camera, live.
 *
 * `useCamera` owns the whole controller lifecycle — `availableCameras`,
 * `initialize`, the `mounted` check, `dispose` — and hands back a handle that
 * is null until it is ready, which is why the preview is guarded.
 */
export const CaptureTab = () => {
  const cam = useCamera({ resolution: 'high' });
  const [state, setState] = useStore(notebookStore);

  const capture = async () => {
    if (!cam) {
      return;
    }

    const photo = await cam.takePicture();
    setState({ lastPhotoPath: photo.path, captures: state.captures + 1 });
  };

  return (
    <Column>
      <Expanded>
        <Center>
          {cam && (
            <AspectRatio aspectRatio={0.75}>
              <CameraPreview controller={cam} />
            </AspectRatio>
          )}
        </Center>
      </Expanded>
      <Padding padding={16}>
        <Column>
          <Text>{state.captures} captured this session</Text>
          <Padding padding={{ vertical: 8 }}>
            <Text>{state.lastPhotoPath}</Text>
          </Padding>
          <ElevatedButton onClick={capture}>Take photo</ElevatedButton>
        </Column>
      </Padding>
    </Column>
  );
};
