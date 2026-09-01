import { Center, Column, Text } from 'flutter-tsx';
import { CameraPreview, useCamera } from 'plugin:camera';

export const Viewfinder = () => {
  const cam = useCamera();

  return (
    <Column>
      <Text>Viewfinder</Text>
      <Center>{cam && <CameraPreview controller={cam} />}</Center>
    </Column>
  );
};
