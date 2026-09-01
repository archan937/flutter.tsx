import { Column, SizedBox, Text, useState } from 'flutter-tsx';

interface Segment {
  id: number;
  seconds: number;
}

export const label = (seconds: number): string => `${seconds}s`;

export const SegmentRow = ({ segment }: { segment: Segment }) => {
  const [width] = useState(120);

  return (
    <Column>
      <Text>Segment {segment.id}</Text>
      <SizedBox width={width} height={segment.seconds}>
        <Text>{label(segment.seconds)}</Text>
      </SizedBox>
    </Column>
  );
};
