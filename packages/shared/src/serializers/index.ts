import type { User } from "../db/schema";

type Item = {
  id: number;
};

export type Attrs = Record<number, Record<string, any>>;

export interface Serializer<T extends Item> {
  attrs?(itemList: T[], currentUser?: User | null): Promise<Attrs>;
  item(
    item: T,
    attrs: Record<string, Record<string, any>>,
    currentUser?: User | null,
  ): Record<string, any>;
}

export async function DefaultAttrs<T extends Item>(
  itemList: T[],
  currentUser?: User | null,
): Promise<Attrs> {
  return Object.fromEntries(itemList.map((i) => [i.id, {}]));
}

type SerializedResult<T extends Item> = ReturnType<Serializer<T>["item"]>;

export async function serialize<T extends Item>(
  serializer: Serializer<T>,
  item: T,
  currentUser?: User | null,
  excludeFields?: string[],
): Promise<SerializedResult<T>>;
export async function serialize<T extends Item>(
  serializer: Serializer<T>,
  itemList: T[],
  currentUser?: User | null,
  excludeFields?: string[],
): Promise<SerializedResult<T>[]>;
export async function serialize<T extends Item>(
  serializer: Serializer<T>,
  itemList: T | T[],
  currentUser?: User | null,
  excludeFields: string[] = [],
): Promise<SerializedResult<T>[] | SerializedResult<T>> {
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
  );

  return Array.isArray(itemList) ? results : results[0];
}

function removeAttributes(object: Record<string, any>, names: string[]) {
  const nameSet = new Set(names);
  return {
    ...Object.fromEntries(
      Object.entries(object).filter(([key]) => !nameSet.has(key)),
    ),
  };
}
