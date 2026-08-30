import { Column, Text, useEffect, useState } from 'flutter-tsx';
import { closeInAppWebView } from 'plugin:url_launcher';

export const Browser = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(true);
    return () => {
      void closeInAppWebView();
    };
  }, []);

  return (
    <Column>
      <Text>{open ? 'Open' : 'Closed'}</Text>
    </Column>
  );
};
