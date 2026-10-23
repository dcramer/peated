import { inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import type { User, WrongPhotoMatch } from "../db/schema";
import { bottles } from "../db/schema";
import { notEmpty } from "../lib/filter";
import { absoluteUrl } from "../lib/urls";
import { type WrongPhotoMatchSchema } from "../schemas";
import { bottleRowColumns, BottleSerializer } from "./bottle";

type WrongPhotoMatchAttrs = {
  wrongBottle: ReturnType<(typeof BottleSerializer)["item"]> | null;
  correctBottle: ReturnType<(typeof BottleSerializer)["item"]> | null;
};

export const WrongPhotoMatchSerializer = serializer({
  name: "wrongPhotoMatch",
  attrs: async (
    itemList: WrongPhotoMatch[],
    currentUser?: User,
  ): Promise<Record<string, WrongPhotoMatchAttrs>> => {
    const bottleIds = [
      ...new Set(
        itemList
          .flatMap((item) => [item.wrongBottleId, item.correctBottleId])
          .filter(notEmpty),
      ),
    ];
    const bottleList = bottleIds.length
      ? await db
          .select(bottleRowColumns)
          .from(bottles)
          .where(inArray(bottles.id, bottleIds))
      : [];
    const serializedBottles = await serialize(
      BottleSerializer,
      bottleList,
      currentUser,
    );
    const bottlesById = new Map(
      bottleList.map((bottle, index) => [bottle.id, serializedBottles[index]]),
    );

    return Object.fromEntries(
      itemList.map((item) => [
        item.id,
        {
          wrongBottle: item.wrongBottleId
            ? (bottlesById.get(item.wrongBottleId) ?? null)
            : null,
          correctBottle: item.correctBottleId
            ? (bottlesById.get(item.correctBottleId) ?? null)
            : null,
        },
      ]),
    );
  },

  item: (
    item: WrongPhotoMatch,
    attrs: WrongPhotoMatchAttrs,
  ): z.infer<typeof WrongPhotoMatchSchema> => {
    return {
      id: item.id,
      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,
      imageEvidence: item.imageEvidence,
      wrongBottle: attrs.wrongBottle,
      correctBottle: attrs.correctBottle,
      traceId: item.traceId,
      createdAt: item.createdAt.toISOString(),
    };
  },
});
