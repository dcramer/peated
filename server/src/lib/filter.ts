export const filter = (obj: Object, f: (key: string) => boolean) => {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => f(k)));
};
export const select = (obj: Object, ...props: string[]) =>
  filter(obj, (k) => props.includes(k));

export const omit = (obj: Object, ...props: string[]) =>
  filter(obj, (k) => !props.includes(k));
