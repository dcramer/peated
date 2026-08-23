export const filter = <T extends object>(
  obj: T,
  f: (key: string) => boolean,
) => {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => f(k)));
};
export const select = <T extends object>(obj: T, ...props: string[]) =>
  filter(obj, (k) => props.includes(k));

export const omit = <T extends object>(obj: T, ...props: string[]) =>
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
