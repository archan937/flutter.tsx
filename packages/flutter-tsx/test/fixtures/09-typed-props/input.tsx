import { Column, Text, useState } from 'flutter-tsx';

interface TaskProps {
  title: string;
  done: boolean;
}

const Task = ({ title, done }: TaskProps) => (
  <Text>{done ? `✓ ${title}` : title}</Text>
);

export const TaskBoard = () => {
  const [titles] = useState(['Ship step 21', 'Camera plugin']);

  return (
    <Column>
      <Text>{titles.length} open tasks</Text>
      <>
        <Task title="Write goldens" done={true} />
        <Task title="Trust the sweep" done={false} />
      </>
    </Column>
  );
};
