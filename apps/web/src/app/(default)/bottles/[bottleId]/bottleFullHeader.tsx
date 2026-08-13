import type { Outputs } from "@peated/server/orpc/router";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import BottleHeader from "@peated/web/components/bottleHeader";
import Button from "@peated/web/components/button";
import CollectionAction from "@peated/web/components/collectionAction";
import FlavorProfile from "@peated/web/components/flavorProfile";
import ShareButton from "@peated/web/components/shareButton";
import SkeletonButton from "@peated/web/components/skeletonButton";
import { getBottlePlainTextIdentity } from "@peated/web/lib/bottleLabel";
import { Suspense } from "react";
import BottleActions from "./bottleActions";

export default function BottleFullHeader({
  bottle,
}: {
  bottle: Outputs["bottles"]["details"];
}) {
  const bottleIdentity = getBottlePlainTextIdentity(bottle);

  return (
    <div className="w-full p-3 lg:py-0">
      <BottleHeader bottle={bottle} />

      <div className="mb-5 mt-4 flex flex-col justify-center gap-2 sm:flex-row lg:justify-start">
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

          <Button href={`/bottles/${bottle.id}/addTasting`} color="primary">
            <PeatedGlyph className="h-4 w-4" /> Log Tasting
          </Button>

          <ShareButton title={bottleIdentity} url={`/bottles/${bottle.id}`} />

          <BottleActions bottle={bottle} />
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
