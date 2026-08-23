export interface ConstantReference {
  readonly namespace: string;
  readonly name: string;
}

export const declareConstants = <TShape>(namespace: string): TShape =>
  new Proxy(
    {},
    {
      get: (_target, property): ConstantReference => ({
        namespace,
        name: String(property),
      }),
    },
  ) as TShape;
