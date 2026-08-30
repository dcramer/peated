import type { Outputs } from "@peated/server/orpc/router";

import {
  formatBottleDisplayName,
  type BottleDisplayNameSource,
} from "@peated/server/lib/bottleDisplayName";
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

type Tasting = Outputs["tastings"]["list"]["results"][number];

type TastingEntryRecord = {
  bottle: BottleDisplayNameSource & BottleMetadata & { id: number };
  id: number;
  notes?: string | null;
  ratingBand?: TastingEntryMember["ratingBand"] | null;
  tags?: readonly string[] | null;
};

export function getTastingEntryMember(
  tasting: TastingEntryRecord,
): TastingEntryMember {
  return {
    description: tasting.notes ?? undefined,
    descriptionHref: `/tastings/${tasting.id}`,
    href: `/bottles/${tasting.bottle.id}`,
    metadata: getBottleMetadata(tasting.bottle),
    name: formatBottleDisplayName(tasting.bottle),
    notes: tasting.tags ?? undefined,
    ratingBand: tasting.ratingBand ?? undefined,
  };
}

export function TastingRecordEntry({
  showAvatar = true,
  showFullNotes = false,
  tasting,
}: {
  showAvatar?: boolean;
  showFullNotes?: boolean;
  tasting: Tasting;
}) {
  const member = getTastingEntryMember(tasting);

  return (
    <TastingEntry
      author={tasting.createdBy.username}
      authorHref={`/users/${tasting.createdBy.username}`}
      date={<TimeSince date={tasting.createdAt} />}
      leading={
        showAvatar ? (
          <MemberAvatar
            pictureUrl={tasting.createdBy.pictureUrl}
            username={tasting.createdBy.username}
          />
        ) : undefined
      }
      members={[
        showFullNotes ? { ...member, descriptionHref: undefined } : member,
      ]}
    />
  );
}
