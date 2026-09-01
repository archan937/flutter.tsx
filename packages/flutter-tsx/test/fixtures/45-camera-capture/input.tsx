import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useCamera } from 'plugin:camera';

export const Capture = () => {
  const cam = useCamera();
  const [savedTo, setSavedTo] = useState('nothing yet');

  const take = async () => {
    const photo = await cam?.takePicture();
    setSavedTo(photo?.path ?? 'cancelled');
  };

  return (
    <Column>
      <Text>{savedTo}</Text>
      <ElevatedButton onClick={take}>Take photo</ElevatedButton>
    </Column>
  );
};
