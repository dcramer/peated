import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";
import BottleIcon from "@peated/web/assets/bottle.svg";
import Link from "@peated/web/components/link";
import BottleMetadata from "./bottleMetadata";
import PageHeader from "./pageHeader";

export default function BottleHeader({
  bottle,
  href,
}: {
  bottle: Bottle;
  href?: string;
}) {
  return (
    <PageHeader
      icon={BottleIcon}
      title={
        <div className="flex gap-x-2">
          {href ? (
            <Link href={href} className="hover:underline">
              {bottle.fullName}
            </Link>
          ) : (
            <div className="flex gap-x-2">
              <Link
                href={`/entities/${bottle.brand.id}`}
                className="hover:underline"
              >
                {bottle.brand.shortName || bottle.brand.name}
              </Link>
              {bottle.name}
            </div>
          )}
          {!!bottle.edition && (
            <span className="text-muted">{bottle.edition}</span>
          )}
        </div>
      }
      titleExtra={
        <BottleMetadata
          data={bottle}
          className="text-muted w-full truncate text-center lg:text-left"
        />
      }
      metadata={
        (bottle.category || bottle.statedAge) && (
          <div className="text-muted flex w-full min-w-[150px] flex-col items-center justify-center gap-x-1 lg:w-auto lg:items-end">
            <div>
              {bottle.category && (
                <Link
                  href={`/bottles?category=${encodeURIComponent(
                    bottle.category
                  )}`}
                  className="hover:underline"
                >
                  {formatCategoryName(bottle.category)}
                </Link>
              )}
            </div>
            <div>
              {bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
            </div>
          </div>
        )
      }
    />
  );
}
