import { Column, ElevatedButton } from 'flutter-tsx';

export const Styled = () => {
  const style = ElevatedButton.styleFrom({
    backgroundColor: 'indigo',
    foregroundColor: 'white',
  });

  return (
    <Column>
      <ElevatedButton style={style} onClick={() => {}}>
        Save
      </ElevatedButton>
    </Column>
  );
};
