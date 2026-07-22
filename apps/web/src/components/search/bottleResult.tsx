import { formatCategoryName } from "@peated/server/lib/format";
import { toTitleCase } from "@peated/server/lib/strings";
import type { Bottle } from "@peated/server/types";
import BottleIcon from "@peated/web/assets/bottle.svg";
import BottleStatusIcons from "@peated/web/components/bottleStatusIcons";
import Link from "@peated/web/components/link";
import {
  getAddBottleHref,
  type AddBottleRouteIntent,
  type PendingImageRouteState,
} from "@peated/web/lib/addBottle";
import { type ReactNode } from "react";
import Join from "../join";
export type BottleResult = {
  type: "bottle";
  ref: Bottle;
};
export type { AddBottleRouteIntent };

type BottleMetadataItem = {
  key: string;
  content: ReactNode;
};

function getBottleMetadata(bottle: Bottle): BottleMetadataItem[] {
  const metadata: BottleMetadataItem[] = [];

  if (bottle.distillers.length) {
    metadata.push({
      key: "distillers",
      content: (
        <Join divider=", ">
          {bottle.distillers.map((distiller) => (
            <span key={distiller.id}>{distiller.name}</span>
          ))}
        </Join>
      ),
    });
  }

  if (bottle.category) {
    metadata.push({
      key: "category",
      content: formatCategoryName(bottle.category),
    });
  }
  if (bottle.statedAge !== null) {
    metadata.push({ key: "age", content: `${bottle.statedAge} years` });
  }
  if (bottle.abv !== null) {
    metadata.push({ key: "abv", content: `${bottle.abv.toFixed(1)}% ABV` });
  }
  if (bottle.vintageYear !== null) {
    metadata.push({
      key: "vintage",
      content: `${bottle.vintageYear} vintage`,
    });
  }
  if (bottle.releaseYear !== null) {
    metadata.push({
      key: "release",
      content: `${bottle.releaseYear} release`,
    });
  }
  if (bottle.singleCask) {
    metadata.push({ key: "single-cask", content: "Single cask" });
  }
  if (bottle.caskStrength) {
    metadata.push({ key: "cask-strength", content: "Cask strength" });
  }

  const caskDetails = [bottle.caskFill, bottle.caskType, bottle.caskSize]
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .map(toTitleCase)
    .join(" ");
  if (caskDetails) {
    metadata.push({ key: "cask-details", content: `${caskDetails} cask` });
  }

  return metadata;
}

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
  const metadata = getBottleMetadata(bottle);

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
        {metadata.length ? (
          <div className="text-muted mt-1 flex flex-wrap text-sm leading-5">
            {metadata.map(({ key, content }, index) => (
              <span key={key} className="inline-flex whitespace-nowrap">
                {index ? <span className="mx-1.5">&middot;</span> : null}
                {content}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
