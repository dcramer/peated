import type { User } from "@peated/shared/db/schema";

export type Result = Record<string, any>;

type Item = {
  id: number;
};

export type Attrs<T extends Item> = Record<number, Record<string, any>>;

export interface Serializer<T extends Item> {
  attrs?(itemList: T[], currentUser?: User | null): Promise<Attrs<T>>;
  item(
    item: T,
    attrs: Record<string, Record<string, any>>,
    currentUser?: User | null,
  ): Result;
}

export async function DefaultAttrs<T extends Item>(
  itemList: T[],
  currentUser?: User | null,
): Promise<Attrs<T>> {
  return Object.fromEntries(itemList.map((i) => [i, {}]));
}

export async function serialize<T extends Item>(
  serializer: Serializer<T>,
  item: T,
  currentUser?: User | null,
  excludeFields?: string[],
): Promise<Result>;
export async function serialize<T extends Item>(
  serializer: Serializer<T>,
  itemList: T[],
  currentUser?: User | null,
  excludeFields?: string[],
): Promise<Result[]>;
export async function serialize<T extends Item>(
  serializer: Serializer<T>,
  itemList: T | T[],
  currentUser?: User | null,
  excludeFields: string[] = [],
): Promise<Result | Result[]> {
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
