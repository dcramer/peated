import BottleHeader from "@peated/web/components/bottleHeader";
import Button from "@peated/web/components/button";
import CollectionAction from "@peated/web/components/collectionAction";
import ShareButton from "@peated/web/components/shareButton";
import SkeletonButton from "@peated/web/components/skeletonButton";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import ModActions from "./modActions";
import { getBottle } from "./utils.server";

export default async function Layout({
  params,
  tab,
}: {
  params: Record<string, any>;
  tab: ReactNode;
}) {
  const bottleId = Number(params.bottleId);
  const bottle = await getBottle(bottleId);

  // tombstone path - redirect to the absolute url to ensure search engines dont get mad
  if (bottle.id !== bottleId) {
    // const newPath = pathname.replace(
    //   `/bottles/${bottleId}`,
    //   `/bottles/${bottle.id}`,
    // );
    // TODO: this should redirect to subpath
    return redirect(`/bottles/${bottle.id}/`);
  }

  const baseUrl = `/bottles/${bottle.id}`;

  return (
    <>
      <div className="w-full p-3 lg:py-0">
        <BottleHeader bottle={bottle} />

        <div className="my-8 flex justify-center gap-4 lg:justify-start">
          <Suspense fallback={<SkeletonButton className="w-10" />}>
            <CollectionAction bottle={bottle} />
          </Suspense>

          <Button href={`/bottles/${bottle.id}/addTasting`} color="primary">
            Record a Tasting
          </Button>

          <ShareButton title={bottle.fullName} url={`/bottles/${bottle.id}`} />

          <ModActions bottle={bottle} />
        </div>
      </div>

      <Tabs fullWidth border>
        <TabItem as={Link} href={baseUrl} controlled>
          Overview
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/tastings`} controlled>
          Tastings ({bottle.totalTastings.toLocaleString()})
        </TabItem>
        <TabItem as={Link} href={`${baseUrl}/prices`} controlled>
          Prices
        </TabItem>
      </Tabs>

      {tab}
    </>
  );
}
