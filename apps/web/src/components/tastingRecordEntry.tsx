import type { Outputs } from "@peated/server/orpc/router";

import { formatColor, formatServingStyle } from "@peated/server/lib/format";
import {
  MemberAvatar,
  TastingEntry,
  type TastingEntryMember,
} from "@peated/web/components";
import TimeSince from "@peated/web/components/timeSince";
import {
  getBottleIdentityProps,
  type BottleIdentitySource,
} from "@peated/web/lib/bottleListItem";
import { getBottleUrl, getTastingUrl } from "@peated/web/lib/urls";

type Tasting = Outputs["tastings"]["list"]["results"][number];

type TastingEntryRecord = {
  bottle: BottleIdentitySource & { id: number; imageUrl?: string | null };
  color?: number | null;
  comments?: number;
  hasToasted?: boolean;
  id: number;
  imageUrl?: string | null;
  notes?: string | null;
  ratingBand?: TastingEntryMember["ratingBand"] | null;
  servingStyle?: Parameters<typeof formatServingStyle>[0] | null;
  tags?: readonly string[] | null;
  toasts?: number;
};

export function getTastingEntryMember(
  tasting: TastingEntryRecord,
): TastingEntryMember {
  return {
    bottle: getBottleIdentityProps(tasting.bottle),
    color:
      tasting.color === null || tasting.color === undefined
        ? undefined
        : formatColor(tasting.color),
    comments: tasting.comments,
    notes: tasting.notes ?? undefined,
    notesHref: getTastingUrl(tasting),
    hasToasted: tasting.hasToasted,
    href: getBottleUrl(tasting.bottle),
    imageUrl: tasting.imageUrl ?? tasting.bottle.imageUrl,
    tags: tasting.tags ?? undefined,
    ratingBand: tasting.ratingBand ?? undefined,
    servingStyle: tasting.servingStyle
      ? formatServingStyle(tasting.servingStyle)
      : undefined,
    tastingId: tasting.id,
    toasts: tasting.toasts,
  };
}

export function TastingRecordEntry({
  showAvatar = true,
  tasting,
}: {
  showAvatar?: boolean;
  tasting: Tasting;
}) {
  const member = getTastingEntryMember(tasting);

  return (
    <TastingEntry
      author={tasting.createdBy.username}
      authorHref={`/users/${tasting.createdBy.username}`}
      authorId={tasting.createdBy.id}
      date={<TimeSince date={tasting.createdAt} />}
      leading={
        showAvatar ? (
          <MemberAvatar
            pictureUrl={tasting.createdBy.pictureUrl}
            username={tasting.createdBy.username}
          />
        ) : undefined
      }
      members={[member]}
    />
  );
}
