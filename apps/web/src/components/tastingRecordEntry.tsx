import type { Outputs } from "@peated/server/orpc/router";

import {
  TastingEntry,
  type TastingEntryMember,
} from "@peated/web/components/designSystem/components";
import { Avatar } from "@peated/web/components/designSystem/components/avatar.stylex";
import TimeSince from "@peated/web/components/timeSince";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";

type Tasting = Outputs["tastings"]["list"]["results"][number];

export function TastingRecordEntry({
  showAvatar = true,
  tasting,
}: {
  showAvatar?: boolean;
  tasting: Tasting;
}) {
  const member: TastingEntryMember = {
    description: tasting.notes,
    href: `/bottles/${tasting.bottle.id}`,
    metadata: getBottleMetadata(tasting.bottle),
    name: tasting.bottle.fullName,
    notes: tasting.tags,
    ratingBand: tasting.ratingBand ?? undefined,
  };

  return (
    <TastingEntry
      author={tasting.createdBy.username}
      authorHref={`/users/${tasting.createdBy.username}`}
      date={<TimeSince date={tasting.createdAt} />}
      leading={
        showAvatar ? (
          <Avatar
            imageUrl={tasting.createdBy.pictureUrl}
            initials={tasting.createdBy.username
              .slice(0, 2)
              .toLocaleUpperCase()}
          />
        ) : undefined
      }
      members={[member]}
    />
  );
}
