import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useCamera } from 'plugin:camera';

export const Selfie = () => {
  const cam = useCamera({ lens: 'front', resolution: 'veryHigh' });
  const [taken, setTaken] = useState(false);

  const takePhoto = async () => {
    await cam?.takePicture();
    setTaken(true);
  };

  return (
    <Column>
      {taken && <Text>Saved!</Text>}
      <ElevatedButton onClick={takePhoto}>Snap</ElevatedButton>
    </Column>
  );
};
