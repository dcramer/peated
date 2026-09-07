import type { MemberReview, User } from "@peated/server/db/schema";
import { users } from "@peated/server/db/schema";
import { notEmpty } from "@peated/server/lib/filter";
import type { MemberReviewSchema } from "@peated/server/schemas";
import type { TagCategory } from "@peated/server/types";
import { inArray } from "drizzle-orm";
import type { z } from "zod";
import { serialize, serializer } from ".";
import config from "../config";
import { db } from "../db";
import { absoluteUrl } from "../lib/urls";
import { categoriesForTags, loadTagCategories } from "./tagCategories";
import { UserSerializer } from "./user";

type Attrs = {
  createdBy: ReturnType<(typeof UserSerializer)["item"]>;
  friends: ReturnType<(typeof UserSerializer)["item"]>[];
  tagCategories: Record<string, TagCategory>;
};

export const MemberReviewSerializer = serializer({
  name: "memberReview",
  attrs: async (
    itemList: MemberReview[],
    currentUser?: User,
  ): Promise<Record<number, Attrs>> => {
    const categoriesByTag = await loadTagCategories(
      itemList.flatMap((item) => item.tags),
    );
    const userIds = [
      ...new Set(
        itemList.flatMap(({ createdById, friends }) => [
          createdById,
          ...friends,
        ]),
      ),
    ];
    const userList = await db
      .select()
      .from(users)
      .where(inArray(users.id, userIds));
    const serialized = await serialize(UserSerializer, userList, currentUser);
    const usersById = new Map(
      userList.map((user, index) => [user.id, serialized[index]!]),
    );
    return Object.fromEntries(
      itemList.map((review) => {
        const createdBy = usersById.get(review.createdById);
        if (!createdBy) {
          throw new Error(
            `Member review ${review.id} references missing member ${review.createdById}.`,
          );
        }
        return [
          review.id,
          {
            createdBy,
            friends: review.friends
              .map((friendId) => usersById.get(friendId))
              .filter(notEmpty),
            tagCategories: categoriesForTags(review.tags, categoriesByTag),
          },
        ];
      }),
    );
  },
  item: (
    item: MemberReview,
    attrs: Attrs,
  ): z.infer<typeof MemberReviewSchema> => ({
    id: item.id,
    bottleId: item.bottleId,
    score: item.score,
    tags: item.tags,
    noseTags: item.noseTags,
    palateTags: item.palateTags,
    finishTags: item.finishTags,
    tagCategories: attrs.tagCategories,
    color: item.color,
    notes: item.notes,
    servingStyle: item.servingStyle,
    friends: attrs.friends,
    imageUrl: item.imageUrl
      ? absoluteUrl(config.API_SERVER, item.imageUrl)
      : null,
    createdBy: attrs.createdBy,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }),
});
