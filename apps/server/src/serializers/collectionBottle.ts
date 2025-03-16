import { type z } from "zod";
import { serialize, serializer } from ".";
import type {
  Bottle,
  BottleRelease,
  CollectionBottle,
  User,
} from "../db/schema";
import { type CollectionBottleSchema } from "../schemas";
import { BottleSerializer } from "./bottle";
import { BottleReleaseSerializer } from "./bottleRelease";

type CollectionBottleAttrs = {
  bottle: ReturnType<(typeof BottleSerializer)["item"]>;
  release: ReturnType<(typeof BottleReleaseSerializer)["item"]> | null;
};

export const CollectionBottleSerializer = serializer({
  attrs: async (
    itemList: (CollectionBottle & {
      bottle: Bottle;
      release: BottleRelease;
    })[],
    currentUser?: User,
  ): Promise<Record<number, CollectionBottleAttrs>> => {
    const bottleList = itemList.map((i) => i.bottle);
    const bottlesById = Object.fromEntries(
      (await serialize(BottleSerializer, bottleList, currentUser)).map(
        (data, index) => [bottleList[index].id, data],
      ),
    );

    const releaseList = itemList.map((i) => i.release);
    const releasesById = Object.fromEntries(
      (await serialize(BottleReleaseSerializer, releaseList, currentUser)).map(
        (data, index) => [releaseList[index].id, data],
      ),
    );
    return Object.fromEntries(
      itemList.map((item) => {
        return [
          item.id,
          {
            bottle: bottlesById[item.bottleId],
            release: item.releaseId ? releasesById[item.releaseId] : null,
          },
        ];
      }),
    );
  },
  item: (
    item: CollectionBottle & {
      bottle: Bottle;
    },
    attrs: CollectionBottleAttrs,
    currentUser?: User,
  ): z.infer<typeof CollectionBottleSchema> => {
    return {
      id: item.id,
      bottle: attrs.bottle,
      release: attrs.release,
    };
  },
});
