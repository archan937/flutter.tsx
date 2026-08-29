import { Column, Text } from 'flutter-tsx';

interface Job {
  title: string;
  remote: boolean;
}

export const JobBoard = ({ jobs }: { jobs: Job[] }) => (
  <Column>
    {jobs.map((job) => (
      <Text>{job.title}</Text>
    ))}
  </Column>
);
