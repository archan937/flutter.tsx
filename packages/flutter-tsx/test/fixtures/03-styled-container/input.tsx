import { Column, Container, Text } from 'flutter-tsx';

export const StyledCard = () => (
  <Container padding={16} color="#7B1FA2" alignment="center">
    <Column mainAxisSize="min">
      <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
        Styled
      </Text>
      <Text style={{ color: 'white70' }}>with value props</Text>
    </Column>
  </Container>
);
