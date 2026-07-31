import type { Bottle } from "@peated/server/types";
import BottleIcon from "@peated/web/assets/bottle.svg";
import BottleExactMetadata, {
  hasBottleExactMetadata,
} from "@peated/web/components/bottleExactMetadata";
import Link from "@peated/web/components/link";
import { getBottleLabel } from "@peated/web/lib/bottleLabel";
import BottleMetadata from "./bottleMetadata";
import PageHeader from "./pageHeader";
import SingleCaskChip from "./singleCaskChip";

export default function BottleHeader({
  bottle,
  href,
  compact,
}: {
  bottle: Bottle;
  href?: string;
  compact?: boolean;
}) {
  const label = getBottleLabel(bottle);
  const metadataExclude = bottle.singleCask ? (["single-cask"] as const) : [];

  return (
    <PageHeader
      icon={BottleIcon}
      compact={compact}
      title={
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <Link
              href={href}
              title={bottle.fullName}
              className="hover:underline"
            >
              {label}
            </Link>
          ) : (
            <div
              title={bottle.fullName}
              className="flex flex-wrap items-center gap-2"
            >
              <Link
                href={`/entities/${bottle.brand.id}`}
                className="hover:underline"
              >
                {bottle.brand.shortName || bottle.brand.name}
              </Link>
              {bottle.group?.name || bottle.name}
            </div>
          )}
          {bottle.singleCask && <SingleCaskChip />}
        </div>
      }
      titleExtra={
        <BottleMetadata
          data={bottle}
          className="text-muted w-full truncate text-center lg:text-left"
        />
      }
      metadata={
        hasBottleExactMetadata(bottle, metadataExclude) ? (
          <BottleExactMetadata bottle={bottle} exclude={metadataExclude} />
        ) : null
      }
    />
  );
}
