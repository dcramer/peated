import type { User } from "../db/schema";

type Item = {
  id: number;
};

export type Attrs = Record<number, Record<string, any>>;

export interface Serializer<
  T extends Item = Item,
  R extends Record<string, any> = Record<string, any>,
  A extends Record<string, any> = Record<string, any>,
> {
  attrs?(itemList: T[], currentUser?: User | null): Promise<Record<number, A>>;
  item(item: T, attrs: A, currentUser?: User | null): R;
}

export async function DefaultAttrs<T extends Item>(
  itemList: T[],
  currentUser?: User | null,
): Promise<Attrs> {
  return Object.fromEntries(itemList.map((i) => [i.id, {}]));
}

export async function serialize<T extends Item, R extends Record<string, any>>(
  serializer: Serializer<T, R>,
  item: T,
  currentUser?: User | null,
  excludeFields?: string[],
): Promise<R>;
export async function serialize<T extends Item, R extends Record<string, any>>(
  serializer: Serializer<T, R>,
  itemList: T[],
  currentUser?: User | null,
  excludeFields?: string[],
): Promise<R[]>;
export async function serialize<T extends Item, R extends Record<string, any>>(
  serializer: Serializer<T, R>,
  itemList: T | T[],
  currentUser?: User | null,
  excludeFields: string[] = [],
): Promise<R | R[]> {
  if (Array.isArray(itemList) && !itemList.length) return [];

  const attrs = await (serializer.attrs || DefaultAttrs<T>)(
    Array.isArray(itemList) ? itemList : [itemList],
    currentUser,
  );

  const results = (Array.isArray(itemList) ? itemList : [itemList]).map(
    (i: T) =>
      removeAttributes(
        serializer.item(i, attrs[i.id] || {}, currentUser),
        excludeFields,
      ),
  ) as R[];

  return Array.isArray(itemList) ? results : results[0];
}

export function serializer<T extends Item, R extends Record<string, any>>(
  v: Serializer<T, R>,
) {
  return v;
}

function removeAttributes(object: Record<string, any>, names: string[]) {
  const nameSet = new Set(names);
  return {
    ...Object.fromEntries(
      Object.entries(object).filter(([key]) => !nameSet.has(key)),
    ),
  };
}
