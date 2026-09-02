import {
  AlignTransition,
  Column,
  ElevatedButton,
  Text,
  tween,
  useAnimation,
} from 'flutter-tsx';

export const Drifter = () => {
  const drift = useAnimation({ duration: 400 });

  const run = () => {
    drift.forward();
  };

  return (
    <Column>
      <AlignTransition
        alignment={tween(drift, { from: 'topLeft', to: 'bottomRight' })}
      >
        <Text>Drifts across</Text>
      </AlignTransition>
      <ElevatedButton onClick={run}>Run</ElevatedButton>
    </Column>
  );
};
