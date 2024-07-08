import { CheckBadgeIcon, StarIcon } from "@heroicons/react/24/outline";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";
import BottleIcon from "@peated/web/assets/bottle.svg";
import Link from "@peated/web/components/link";
export type BottleResult = {
  type: "bottle";
  ref: Bottle;
};

export default function BottleResultRow({
  result: { ref: bottle },
  directToTasting = false,
}: {
  result: BottleResult;
  directToTasting: boolean;
}) {
  return (
    <>
      <BottleIcon className="m-2 hidden h-10 w-auto sm:block" />

      <div className="min-w-0 flex-auto">
        <div className="flex items-center space-x-1 font-semibold leading-6">
          <Link
            href={
              directToTasting
                ? `/bottles/${bottle.id}/addTasting`
                : `/bottles/${bottle.id}`
            }
          >
            <span className="absolute inset-x-0 -top-px bottom-0" />
            {bottle.name}
          </Link>
          {bottle.vintageYear && (
            <>
              {" "}
              <span className="text-light">({bottle.vintageYear})</span>
            </>
          )}
          {bottle.isFavorite && (
            <StarIcon className="h-4 w-4" aria-hidden="true" />
          )}
          {bottle.hasTasted && (
            <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
        <div className="text-light mt-1 flex truncate text-sm leading-5">
          {bottle.brand.name}
        </div>
      </div>
      <div className="flex items-center gap-x-4">
        <div className="hidden sm:flex sm:flex-col sm:items-end">
          <div className="text-light leading-6">
            {bottle.category && formatCategoryName(bottle.category)}
          </div>
          <div className="text-light mt-1 text-sm leading-5">
            {bottle.statedAge ? `${bottle.statedAge} years` : null}
          </div>
        </div>
      </div>
    </>
  );
}
