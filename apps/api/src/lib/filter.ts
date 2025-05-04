export const filter = (obj: object, f: (key: string) => boolean) => {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => f(k)));
};
export const select = (obj: object, ...props: string[]) =>
  filter(obj, (k) => props.includes(k));

export const omit = (obj: object, ...props: string[]) =>
  filter(obj, (k) => !props.includes(k));

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// https://johnnyreilly.com/bulletproof-uniq-with-typescript
export function uniq<T extends string | number | bigint | boolean | symbol>(
  iterable: Iterable<T>,
) {
  return [...new Set(iterable)];
}
