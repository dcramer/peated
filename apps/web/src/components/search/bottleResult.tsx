import type { Bottle } from "@peated/server/types";
import BottleIcon from "@peated/web/assets/bottle.svg";
import BottleExactMetadata from "@peated/web/components/bottleExactMetadata";
import BottleStatusIcons from "@peated/web/components/bottleStatusIcons";
import Link from "@peated/web/components/link";
import {
  getAddBottleHref,
  type AddBottleRouteIntent,
  type PendingImageRouteState,
} from "@peated/web/lib/addBottle";
import Join from "../join";
export type BottleResult = {
  type: "bottle";
  ref: Bottle;
};
export type { AddBottleRouteIntent };

/**
 * Builds the bottle-row destination, with Add Bottle route intents taking
 * precedence over the legacy direct-to-tasting shortcut.
 */
export function getBottleResultHref({
  bottleId,
  directToTasting = false,
  addBottleIntent,
  pendingImage,
}: {
  bottleId: number;
  directToTasting?: boolean;
  addBottleIntent?: AddBottleRouteIntent;
  pendingImage?: PendingImageRouteState | null;
}) {
  if (addBottleIntent) {
    return getAddBottleHref({
      bottleId,
      intent: addBottleIntent,
      pendingImageId: pendingImage?.id,
      pendingImageUrl: pendingImage?.imageUrl,
    });
  }

  if (directToTasting) {
    return getAddBottleHref({ bottleId, intent: "tasting" });
  }

  return `/bottles/${bottleId}`;
}

export default function BottleResultRow({
  result: { ref: bottle },
  directToTasting = false,
  addBottleIntent,
  pendingImage,
}: {
  result: BottleResult;
  directToTasting: boolean;
  addBottleIntent?: AddBottleRouteIntent;
  pendingImage?: PendingImageRouteState | null;
}) {
  const distillerMetadata = bottle.distillers.length ? (
    <Join divider=", ">
      {bottle.distillers.map((distiller) => (
        <span key={distiller.id}>{distiller.name}</span>
      ))}
    </Join>
  ) : undefined;

  return (
    <>
      <BottleIcon className="m-2 hidden h-10 w-auto sm:block" />

      <div className="min-w-0 flex-auto">
        <div className="flex items-center space-x-1 font-semibold leading-6">
          <Link
            href={getBottleResultHref({
              bottleId: bottle.id,
              directToTasting,
              addBottleIntent,
              pendingImage,
            })}
          >
            <span className="absolute inset-x-0 -top-px bottom-0" />
            <span>{bottle.fullName}</span>
          </Link>
          <BottleStatusIcons bottle={bottle} />
        </div>
        <BottleExactMetadata
          bottle={bottle}
          leadingContent={distillerMetadata}
        />
        {bottle.group && bottle.group.totalBottles > 1 ? (
          <div className="mt-1 text-xs">
            <Link
              href={`/bottle-groups/${bottle.group.id}`}
              className="text-muted relative z-10 hover:underline"
            >
              {bottle.group.totalBottles.toLocaleString()} related releases
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}
