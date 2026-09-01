import type { Outputs } from "@peated/server/orpc/router";

import {
  formatBottleDisplayName,
  type BottleDisplayNameSource,
} from "@peated/server/lib/bottleDisplayName";
import { formatColor, formatServingStyle } from "@peated/server/lib/format";
import {
  MemberAvatar,
  TastingEntry,
  type TastingEntryMember,
} from "@peated/web/components";
import TimeSince from "@peated/web/components/timeSince";
import {
  getBottleMetadata,
  type BottleMetadata,
} from "@peated/web/lib/bottleMetadata";
import { getBottleUrl } from "@peated/web/lib/urls";

type Tasting = Outputs["tastings"]["list"]["results"][number];

type TastingEntryRecord = {
  bottle: BottleDisplayNameSource &
    BottleMetadata & { id: number; imageUrl?: string | null };
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
    color:
      tasting.color === null || tasting.color === undefined
        ? undefined
        : formatColor(tasting.color),
    comments: tasting.comments,
    description: tasting.notes ?? undefined,
    descriptionHref: `/tastings/${tasting.id}`,
    hasToasted: tasting.hasToasted,
    href: getBottleUrl(tasting.bottle),
    imageKind: tasting.imageUrl ? "photo" : "bottle",
    imageUrl: tasting.imageUrl ?? tasting.bottle.imageUrl,
    metadata: getBottleMetadata(tasting.bottle),
    name: formatBottleDisplayName(tasting.bottle),
    notes: tasting.tags ?? undefined,
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
