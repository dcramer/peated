import * as Sentry from "@sentry/node";
import type { User } from "../db/schema";

type Item = Record<string, any>;

export type Attrs = Record<number, Record<string, any>>;

export interface Serializer<
  T extends Item = Item,
  R extends Record<string, any> = Record<string, any>,
  C extends Record<string, any> = Record<string, any>,
  A extends Record<string, any> = Record<string, any>,
> {
  name: string;
  attrs?(
    itemList: T[],
    currentUser?: User | null,
    context?: C
  ): Promise<Record<number, A>>;
  item(item: T, attrs: A, currentUser?: User | null, context?: C): R;
}

export async function DefaultAttrs<T extends Item>(
  itemList: T[],
  currentUser?: User | null
): Promise<Attrs> {
  return Object.fromEntries(itemList.map((i) => [i.id, {}]));
}

export async function serialize<
  T extends Item,
  R extends Record<string, any>,
  C extends Record<string, any>,
>(
  serializer: Serializer<T, R, C>,
  item: T,
  currentUser?: User | null,
  excludeFields?: string[],
  context?: C
): Promise<R>;
export async function serialize<
  T extends Item,
  R extends Record<string, any>,
  C extends Record<string, any>,
>(
  serializer: Serializer<T, R, C>,
  itemList: T[],
  currentUser?: User | null,
  excludeFields?: string[],
  context?: C
): Promise<R[]>;
export async function serialize<
  T extends Item,
  R extends Record<string, any>,
  C extends Record<string, any>,
>(
  serializer: Serializer<T, R, C>,
  itemList: T | T[],
  currentUser?: User | null,
  excludeFields: string[] = [],
  context?: C
): Promise<R | R[]> {
  return await Sentry.startSpan(
    {
      name: `peated.serializer/${serializer.name}`,
      attributes: {
        "item.count": itemList.length,
        "item.type": serializer.name,
      },
    },
    async (span) => {
      if (Array.isArray(itemList) && !itemList.length) return [];

      const attrs = await (serializer.attrs || DefaultAttrs<T>)(
        Array.isArray(itemList) ? itemList : [itemList],
        currentUser,
        context
      );

      const results = (Array.isArray(itemList) ? itemList : [itemList]).map(
        (i: T) =>
          removeAttributes(
            serializer.item(i, attrs[i.id] || {}, currentUser, context),
            excludeFields
          )
      ) as R[];

      return Array.isArray(itemList) ? results : results[0];
    }
  );
}

export function serializer<
  T extends Item,
  R extends Record<string, any>,
  C extends Record<string, any>,
  A extends Record<string, any> = Record<string, any>,
>(v: Serializer<T, R, C, A>) {
  return v;
}

function removeAttributes(object: Record<string, any>, names: string[]) {
  const nameSet = new Set(names);
  return {
    ...Object.fromEntries(
      Object.entries(object).filter(([key]) => !nameSet.has(key))
    ),
  };
}
