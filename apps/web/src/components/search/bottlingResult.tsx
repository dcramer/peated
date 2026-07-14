import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle, BottleRelease } from "@peated/server/types";
import BottleIcon from "@peated/web/assets/bottle.svg";
import BottleStatusIcons from "@peated/web/components/bottleStatusIcons";
import Link from "@peated/web/components/link";
import {
  getAddBottleHref,
  type PendingImageRouteState,
} from "@peated/web/lib/addBottle";
import {
  formatBottleBottlingName,
  getBottleBottlingPath,
} from "@peated/web/lib/bottlings";
import Join from "../join";
import type { AddBottleRouteIntent } from "./bottleResult";

export type BottlingResult = {
  type: "bottling";
  ref: BottleRelease;
  bottle: Bottle;
};

export function getBottlingResultHref({
  bottleId,
  bottlingId,
  directToTasting = false,
  addBottleIntent,
  pendingImage,
}: {
  bottleId: number;
  bottlingId: number;
  directToTasting?: boolean;
  addBottleIntent?: AddBottleRouteIntent;
  pendingImage?: PendingImageRouteState | null;
}) {
  if (addBottleIntent) {
    return getAddBottleHref({
      bottleId,
      releaseId: bottlingId,
      intent: addBottleIntent,
      pendingImageId: pendingImage?.id,
      pendingImageUrl: pendingImage?.imageUrl,
    });
  }

  if (directToTasting) {
    return getAddBottleHref({
      bottleId,
      releaseId: bottlingId,
      intent: "tasting",
    });
  }

  return getBottleBottlingPath(bottleId, bottlingId);
}

export default function BottlingResultRow({
  result: { ref: bottling, bottle },
  directToTasting = false,
  addBottleIntent,
  pendingImage,
}: {
  result: BottlingResult;
  directToTasting: boolean;
  addBottleIntent?: AddBottleRouteIntent;
  pendingImage?: PendingImageRouteState | null;
}) {
  return (
    <>
      <BottleIcon className="m-2 hidden h-10 w-auto sm:block" />

      <div className="min-w-0 flex-auto">
        <div className="flex items-center space-x-1 font-semibold leading-6">
          <Link
            href={getBottlingResultHref({
              bottleId: bottle.id,
              bottlingId: bottling.id,
              directToTasting,
              addBottleIntent,
              pendingImage,
            })}
          >
            <span className="absolute inset-x-0 -top-px bottom-0" />
            <span>{formatBottleBottlingName(bottle, bottling)}</span>
          </Link>
          <BottleStatusIcons
            bottle={{ isLibrary: false, hasTasted: bottling.hasTasted }}
            hideLibrary
          />
        </div>
        <div className="text-muted mt-1 flex gap-x-1 truncate text-sm leading-5">
          <span>Bottling of {bottle.fullName}</span>
          {bottle.distillers.length ? (
            <>
              <span>&middot;</span>
              <Join divider=", ">
                {bottle.distillers.map((distiller) => (
                  <span key={distiller.id}>{distiller.name}</span>
                ))}
              </Join>
            </>
          ) : null}
        </div>
      </div>

      <div className="hidden items-end gap-x-4 sm:flex sm:flex-col">
        <div className="text-muted leading-6">
          {bottle.category && formatCategoryName(bottle.category)}
        </div>
        <div className="text-muted mt-1 text-sm leading-5">
          {bottling.abv !== null ? `${bottling.abv.toFixed(1)}% ABV` : null}
        </div>
      </div>
    </>
  );
}
