import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useCamera } from 'flutter-tsx/plugins';

export const CameraScreen = () => {
  const cam = useCamera();
  const [taken, setTaken] = useState(false);

  const takePhoto = async () => {
    await cam.takePicture();
    setTaken(true);
  };

  return (
    <Column>
      {taken && <Text>Photo saved!</Text>}
      <ElevatedButton onClick={takePhoto}>Take Photo</ElevatedButton>
    </Column>
  );
};
