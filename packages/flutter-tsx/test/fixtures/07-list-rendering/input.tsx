import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';

export const Groceries = () => {
  const [items, setItems] = useState(['Apples', 'Bread']);

  const addItem = () => {
    setItems([...items, 'Milk']);
  };

  return (
    <Column>
      {items.map((item) => (
        <Text>{item}</Text>
      ))}
      <ElevatedButton onClick={addItem}>Add</ElevatedButton>
    </Column>
  );
};
