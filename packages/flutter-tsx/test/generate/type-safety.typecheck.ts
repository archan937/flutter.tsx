// Compile-time proof of the generated API: checked by `tsc` (the quality
// gate fails if any @ts-expect-error stops erroring), never executed.
import { Colors, Icons } from '@src/generated/constants';
import {
  Center,
  type Color,
  Column,
  Container,
  ElevatedButton,
  type IconData,
  Text,
} from '@src/generated/widgets';

export const validUsage = (): unknown => [
  Column({ mainAxisAlignment: 'center', children: [] }),
  Center({ children: Text({ children: 'hello' }) }),
  ElevatedButton({ onClick: () => undefined, children: undefined }),
  Container({ color: Colors.red }),
  Text({ children: 'hi', maxLines: 2 }),
];

export const wrongEnumMember = (): unknown =>
  // @ts-expect-error 'diagonal' is not a MainAxisAlignment member
  Column({ mainAxisAlignment: 'diagonal' });

export const wrongPropType = (): unknown =>
  // @ts-expect-error maxLines takes a number, not a string
  Text({ children: 'hi', maxLines: 'two' });

export const unknownProp = (): unknown =>
  // @ts-expect-error whirlSpeed is not a Center prop
  Center({ whirlSpeed: 11 });

export const valueFormUsage = (): unknown => [
  Container({ color: 'red' }),
  Container({ color: '#7B1FA2' }),
  Container({ padding: 16 }),
  Container({ padding: { horizontal: 8 } }),
  Container({ alignment: 'center' }),
  Text({
    children: 'hi',
    style: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  }),
];

export const wrongColorName = (): unknown =>
  // @ts-expect-error 'blurple' is not a color constant name
  Container({ color: 'blurple' });

export const wrongStyleProperty = (): unknown =>
  // @ts-expect-error glow is not a TextStyle property
  Text({ children: 'hi', style: { glow: 1 } });

// Mixed inset keys slip through TS (union excess-property checking is
// per-union) — the compiler rejects them with TSX0206 instead.
export const mixedInsetsCaughtAtCompileTime = (): unknown =>
  Container({ padding: { top: 1, horizontal: 2 } });

export const brandedAssignability: Color = Colors.red;

export const brandedIcon: IconData = Icons.add;

// @ts-expect-error a MaterialColor is not an IconData
export const brandMismatch: IconData = Colors.red;

export const callbackTyping = (): unknown =>
  // @ts-expect-error onClick takes no arguments
  ElevatedButton({ onClick: (amount: number) => amount, children: undefined });
