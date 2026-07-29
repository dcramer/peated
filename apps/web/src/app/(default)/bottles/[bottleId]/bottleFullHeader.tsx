import type { Outputs } from "@peated/server/orpc/router";
import type { Bottle } from "@peated/server/types";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import BottleHeader from "@peated/web/components/bottleHeader";
import Button from "@peated/web/components/button";
import CollectionAction from "@peated/web/components/collectionAction";
import FlavorProfile from "@peated/web/components/flavorProfile";
import Link from "@peated/web/components/link";
import ShareButton from "@peated/web/components/shareButton";
import SkeletonButton from "@peated/web/components/skeletonButton";
import {
  getAddBottleHref,
  getAddSimilarBottlePath,
} from "@peated/web/lib/addBottle";
import { getReleaseFamilyHref } from "@peated/web/lib/releaseFamily";
import { Suspense } from "react";
import ModActions from "./modActions";

type BottleRelationship = Pick<Bottle, "id"> & {
  group?: Pick<NonNullable<Bottle["group"]>, "totalBottles">;
};

export function BottleRelationshipLinks({
  bottle,
}: {
  bottle: BottleRelationship;
}) {
  return (
    <div className="text-muted mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm lg:justify-start">
      {bottle.group && bottle.group.totalBottles > 1 ? (
        <Link
          href={getReleaseFamilyHref(bottle.id)}
          className="hover:text-white hover:underline"
        >
          View all {bottle.group.totalBottles.toLocaleString()} releases
        </Link>
      ) : null}
      <Link
        href={getAddSimilarBottlePath(bottle.id)}
        className="hover:text-white hover:underline"
      >
        Add a similar bottle
      </Link>
    </div>
  );
}

export default function BottleFullHeader({
  bottle,
}: {
  bottle: Outputs["bottles"]["details"];
}) {
  return (
    <div className="w-full p-3 lg:py-0">
      <BottleHeader bottle={bottle} />

      <BottleRelationshipLinks bottle={bottle} />

      <div className="my-8 flex flex-col justify-center gap-2 sm:flex-row lg:justify-start">
        <div className="flex flex-grow justify-center gap-4 gap-x-2 lg:justify-start">
          <Suspense
            fallback={
              <>
                <SkeletonButton className="w-10" />
                <SkeletonButton className="w-10" />
              </>
            }
          >
            <CollectionAction bottleId={bottle.id} />
          </Suspense>

          <Button
            href={getAddBottleHref({
              bottleId: bottle.id,
              intent: "tasting",
            })}
            color="primary"
          >
            <PeatedGlyph className="h-4 w-4" /> Log Tasting
          </Button>

          <ShareButton title={bottle.fullName} url={`/bottles/${bottle.id}`} />

          <ModActions bottle={bottle} />
        </div>
        <div className="inline-flex flex-col items-center justify-center space-x-1 truncate sm:flex-row sm:items-start">
          {!!bottle.flavorProfile && (
            <FlavorProfile profile={bottle.flavorProfile} />
          )}
        </div>
      </div>
    </div>
  );
}
