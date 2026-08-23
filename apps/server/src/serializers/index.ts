import * as Sentry from "@sentry/node";
import { z } from "zod";
import type { User } from "../db/schema";

interface SerializableItem {}

const SerializableItemIdSchema = z.object({
  id: z.union([z.string(), z.number()]),
});

type EmptyAttrs = Record<never, never>;

export type Attrs = Record<string | number, EmptyAttrs>;

export interface Serializer<
  T extends SerializableItem = SerializableItem,
  R extends object = EmptyAttrs,
  C extends object = EmptyAttrs,
  A extends object = EmptyAttrs,
> {
  name: string;
  attrs?(
    itemList: T[],
    currentUser?: User | null,
    context?: C,
  ): Promise<Record<string | number, A>>;
  item(item: T, attrs: A, currentUser?: User | null, context?: C): R;
}

export async function DefaultAttrs<T extends SerializableItem>(
  itemList: T[],
  currentUser?: User | null,
): Promise<Attrs> {
  return Object.fromEntries(
    itemList.map((item, index) => [itemKey(item, index), {}]),
  );
}

export async function serialize<
  T extends SerializableItem,
  R extends object,
  C extends object,
  A extends object,
>(
  serializer: Serializer<T, R, C, A>,
  item: T,
  currentUser?: User | null,
  excludeFields?: string[],
  context?: C,
): Promise<R>;
export async function serialize<
  T extends SerializableItem,
  R extends object,
  C extends object,
  A extends object,
>(
  serializer: Serializer<T, R, C, A>,
  itemList: T[],
  currentUser?: User | null,
  excludeFields?: string[],
  context?: C,
): Promise<R[]>;
export async function serialize<
  T extends SerializableItem,
  R extends object,
  C extends object,
  A extends object,
>(
  serializer: Serializer<T, R, C, A>,
  itemList: T | T[],
  currentUser?: User | null,
  excludeFields: string[] = [],
  context?: C,
): Promise<R | R[]> {
  return await Sentry.startSpan(
    {
      name: `peated.serializer/${serializer.name}`,
      attributes: {
        "item.count": Array.isArray(itemList) ? itemList.length : 1,
        "item.type": serializer.name,
      },
    },
    async (span) => {
      if (Array.isArray(itemList) && !itemList.length) return [];

      const attrs = await (serializer.attrs || DefaultAttrs<T>)(
        Array.isArray(itemList) ? itemList : [itemList],
        currentUser,
        context,
      );

      const items = Array.isArray(itemList) ? itemList : [itemList];
      const results = items.map((item: T, index) => {
        const itemAttrs = attrs[itemKey(item, index)] ?? {};
        // SAFETY: Serializers without an attrs loader use the default empty attrs contract.
        const serializerAttrs = itemAttrs as A;
        return removeAttributes(
          serializer.item(item, serializerAttrs, currentUser, context),
          excludeFields,
        );
      });

      return Array.isArray(itemList) ? results : results[0];
    },
  );
}

export function serializer<
  T extends SerializableItem,
  R extends object,
  C extends object,
  A extends object = EmptyAttrs,
>(v: Serializer<T, R, C, A>) {
  return v;
}

function removeAttributes<T extends object>(object: T, names: string[]): T {
  const result = { ...object };
  for (const name of names) Reflect.deleteProperty(result, name);
  return result;
}

function itemKey(item: SerializableItem, index: number): string | number {
  const identifiedItem = SerializableItemIdSchema.safeParse(item);
  return identifiedItem.success ? identifiedItem.data.id : index;
}
