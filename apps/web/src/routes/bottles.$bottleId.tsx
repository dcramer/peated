import PeatedGlyph from "@peated/web/assets/glyph.svg?react";
import BottleHeader from "@peated/web/components/bottleHeader";
import Button from "@peated/web/components/button";
import CollectionAction from "@peated/web/components/collectionAction";
import FlavorProfile from "@peated/web/components/flavorProfile";
import ShareButton from "@peated/web/components/shareButton";
import SkeletonButton from "@peated/web/components/skeletonButton";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
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

            <Button asChild color="primary">
              <Link
                to="/bottles/$bottleId/addTasting"
                params={{ bottleId: bottle.id }}
              >
                <PeatedGlyph className="h-4 w-4" /> Record a Tasting
              </Link>
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

      <Tabs border>
        <TabItem asChild controlled>
          <Link to="/bottles/$bottleId" params={{ bottleId: bottle.id }}>
            Overview
          </Link>
        </TabItem>
        <TabItem asChild controlled>
          <Link
            to="/bottles/$bottleId/tastings"
            params={{ bottleId: bottle.id }}
          >
            Tastings ({bottle.totalTastings.toLocaleString()})
          </Link>
        </TabItem>
        <TabItem asChild controlled>
          <Link
            to="/bottles/$bottleId/releases"
            params={{ bottleId: bottle.id }}
          >
            Releases ({bottle.numReleases.toLocaleString()})
          </Link>
        </TabItem>
        <TabItem asChild controlled desktopOnly>
          <Link to="/bottles/$bottleId/prices" params={{ bottleId: bottle.id }}>
            Prices
          </Link>
        </TabItem>
        <TabItem asChild controlled desktopOnly>
          <Link
            to="/bottles/$bottleId/similar"
            params={{ bottleId: bottle.id }}
          >
            Similar
          </Link>
        </TabItem>
      </Tabs>

      <Outlet />
    </DefaultLayout>
  );
}
