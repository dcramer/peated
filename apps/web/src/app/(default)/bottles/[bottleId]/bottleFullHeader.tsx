import type { Bottle } from "@peated/server/types";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import BottleHeader from "@peated/web/components/bottleHeader";
import Button from "@peated/web/components/button";
import CollectionAction from "@peated/web/components/collectionAction";
import FlavorProfile from "@peated/web/components/flavorProfile";
import ShareButton from "@peated/web/components/shareButton";
import SkeletonButton from "@peated/web/components/skeletonButton";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { Suspense } from "react";
import ModActions from "./modActions";

export default function BottleFullHeader({ bottle }: { bottle: Bottle }) {
  return (
    <div className="w-full p-3 lg:py-0">
      <BottleHeader bottle={bottle} />

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
