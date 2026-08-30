import type { Outputs } from "@peated/server/orpc/router";

import {
  MemberAvatar,
  TastingEntry,
  type TastingEntryMember,
} from "@peated/web/components/designSystem/components";
import TimeSince from "@peated/web/components/timeSince";
import {
  getBottleMetadata,
  type BottleMetadata,
} from "@peated/web/lib/bottleMetadata";

type Tasting = Outputs["tastings"]["list"]["results"][number];

type TastingEntryRecord = {
  bottle: BottleMetadata & { fullName: string; id: number };
  notes?: string | null;
  ratingBand?: TastingEntryMember["ratingBand"] | null;
  tags?: readonly string[] | null;
};

export function getTastingEntryMember(
  tasting: TastingEntryRecord,
): TastingEntryMember {
  return {
    description: tasting.notes,
    href: `/bottles/${tasting.bottle.id}`,
    metadata: getBottleMetadata(tasting.bottle),
    name: tasting.bottle.fullName,
    notes: tasting.tags ?? undefined,
    ratingBand: tasting.ratingBand ?? undefined,
  };
}

export function TastingRecordEntry({
  showAvatar = true,
  tasting,
}: {
  showAvatar?: boolean;
  tasting: Tasting;
}) {
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
      members={[getTastingEntryMember(tasting)]}
    />
  );
}
