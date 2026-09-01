import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { CameraException, useCamera } from 'plugin:camera';

export const Shoot = () => {
  const cam = useCamera();
  const [message, setMessage] = useState('nothing yet');

  const shoot = async () => {
    try {
      const photo = await cam?.takePicture();
      setMessage(photo?.path ?? 'cancelled');
    } catch (error) {
      if (error instanceof CameraException) {
        setMessage(error.code);
      } else {
        setMessage(String(error));
      }
    }
  };

  return (
    <Column>
      <Text>{message}</Text>
      <ElevatedButton onClick={shoot}>Take photo</ElevatedButton>
    </Column>
  );
};
