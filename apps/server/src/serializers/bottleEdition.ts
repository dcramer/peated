import { and, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serializer } from ".";
import config from "../config";
import { db } from "../db";
import { tastings, type BottleEdition, type User } from "../db/schema";
import { absoluteUrl } from "../lib/urls";
import { type BottleEditionSchema } from "../schemas";

type Attrs = {
  hasTasted: boolean;
  isFavorite: boolean;
};

export const BottleEditionSerializer = serializer({
  attrs: async (
    itemList: BottleEdition[],
    currentUser?: User,
  ): Promise<Record<number, Attrs>> => {
    const tastedSet = currentUser
      ? new Set(
          (
            await db
              .selectDistinct({ id: tastings.editionId })
              .from(tastings)
              .where(
                and(
                  inArray(
                    tastings.editionId,
                    itemList.map((i) => i.id),
                  ),
                  eq(tastings.createdById, currentUser.id),
                ),
              )
          ).map((r) => r.id),
        )
      : new Set();

    return Object.fromEntries(
      itemList.map((item) => [
        item.id,
        {
          hasTasted: tastedSet.has(item.id),
          isFavorite: false, // TODO
        },
      ]),
    );
  },

  item: (
    item: BottleEdition,
    attrs: Attrs,
  ): z.infer<typeof BottleEditionSchema> => {
    return {
      id: item.id,
      bottleId: item.bottleId,

      fullName: item.fullName,
      name: item.name,

      series: item.series,
      edition: item.edition,

      description: item.description,
      tastingNotes: item.tastingNotes,

      statedAge: item.statedAge,
      caskStrength: item.caskStrength,
      singleCask: item.singleCask,
      abv: item.abv,

      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,

      vintageYear: item.vintageYear,
      releaseYear: item.releaseYear,

      caskType: item.caskType,
      caskFill: item.caskFill,
      caskSize: item.caskSize,

      avgRating: item.avgRating,
      totalTastings: item.totalTastings,

      suggestedTags: item.suggestedTags,
      hasTasted: attrs.hasTasted,
      isFavorite: attrs.isFavorite,

      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  },
});
