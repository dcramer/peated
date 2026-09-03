import type { Outputs } from "@peated/server/orpc/router";
import { getBottleIdentityProps } from "@peated/web/lib/bottleListItem";

import { MemberAvatar, type TastingEntryMember } from "@peated/web/components";
import type { MemberActivityItem } from "@peated/web/components/pages/memberProfileContent.stylex";
import { getTastingEntryMember } from "@peated/web/components/tastingRecordEntry";
import TimeSince from "@peated/web/components/timeSince";
import { getBottleUrl } from "@peated/web/lib/urls";

type Activity = Outputs["users"]["activity"]["list"]["results"][number];

/** Maps one API activity item to the shared profile activity presentation. */
export function toActivityItem(activity: Activity): MemberActivityItem {
  if (activity.type === "collection_add") {
    return {
      activity: {
        author: activity.createdBy.username,
        authorHref: `/users/${activity.createdBy.username}`,
        collectionHref: activity.collection.href ?? undefined,
        collectionName: activity.collection.name,
        date: <TimeSince date={activity.createdAt} />,
        id: activity.id,
        items: activity.items.map((entry) => ({
          ...getBottleIdentityProps(entry.bottle),
          href: getBottleUrl(entry.bottle),
          id: String(entry.id),
          imageUrl: entry.imageUrl ?? entry.bottle.imageUrl,
        })),
        totalItems: activity.totalItems,
      },
      id: activity.id,
      kind: "collection",
    };
  }

  const [firstTasting, ...remainingTastings] = activity.tastings;
  if (!firstTasting) {
    throw new Error("A tasting session must contain a tasting");
  }
  const members: [TastingEntryMember, ...TastingEntryMember[]] = [
    getTastingEntryMember(firstTasting),
    ...remainingTastings.map(getTastingEntryMember),
  ];

  return {
    id: activity.id,
    kind: "tasting",
    tasting: {
      author: activity.createdBy.username,
      authorHref: `/users/${activity.createdBy.username}`,
      authorId: activity.createdBy.id,
      date: <TimeSince date={activity.lastActivityAt} />,
      leading: (
        <MemberAvatar
          pictureUrl={activity.createdBy.pictureUrl}
          username={activity.createdBy.username}
        />
      ),
      members,
    },
  };
}
