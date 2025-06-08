import PeatedGlyph from "@peated/web/assets/glyph.svg";
import BottleHeader from "@peated/web/components/bottleHeader";
import Button from "@peated/web/components/button";
import CollectionAction from "@peated/web/components/collectionAction";
import FlavorProfile from "@peated/web/components/flavorProfile";
import ShareButton from "@peated/web/components/shareButton";
import SkeletonButton from "@peated/web/components/skeletonButton";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DefaultLayout } from "../layouts";

export const Route = createFileRoute("/bottles/$bottleId")({
  component: BottleLayoutPage,
});

function BottleLayoutPage() {
  const { bottleId } = Route.useParams();
  const orpc = useORPC();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({
      input: {
        bottle: Number(bottleId),
      },
    })
  );

  return (
    <DefaultLayout>
      <div className="w-full p-3 lg:py-0">
        <BottleHeader bottle={bottle} />

        <div className="my-8 flex flex-col justify-center gap-2 sm:flex-row lg:justify-start">
          <div className="flex flex-grow justify-center gap-4 gap-x-2 lg:justify-start">
            <Suspense fallback={<SkeletonButton className="w-10" />}>
              <CollectionAction bottle={bottle} />
            </Suspense>

            <Button to={`/bottles/${bottle.id}/addTasting`} color="primary">
              <PeatedGlyph className="h-4 w-4" /> Record a Tasting
            </Button>

            <ShareButton
              title={bottle.fullName}
              url={`/bottles/${bottle.id}`}
            />
          </div>
          <div className="inline-flex flex-col items-center justify-center space-x-1 truncate sm:flex-row sm:items-start">
            {!!bottle.flavorProfile && (
              <FlavorProfile profile={bottle.flavorProfile} />
            )}
          </div>
        </div>
      </div>

      <Outlet />
    </DefaultLayout>
  );
}
