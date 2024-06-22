import BottleHeader from "@peated/web/components/bottleHeader";
import Button from "@peated/web/components/button";
import CollectionAction from "@peated/web/components/collectionAction";
import ShareButton from "@peated/web/components/shareButton";
import SkeletonButton from "@peated/web/components/skeletonButton";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import ModActions from "./modActions";

// export const meta: MetaFunction<typeof loader> = ({ data }) => {
//   if (!data) return [];

//   const description = summarize(data.bottle.description || "", 200);

//   return [
//     {
//       title: data.bottle.fullName,
//     },
//     {
//       name: "description",
//       content: description,
//     },
//     {
//       property: "og:title",
//       content: data.bottle.fullName,
//     },
//     {
//       property: "og:description",
//       content: description,
//     },
//     {
//       property: "twitter:card",
//       content: "product",
//     },
//   ];
// };

export default async function Layout({
  params,
  tab,
}: {
  params: Record<string, any>;
  tab: ReactNode;
}) {
  const bottleId = Number(params.bottleId);

  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.query(bottleId);
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
      <Suspense>
        <div className="w-full p-3 lg:py-0">
          <BottleHeader bottle={bottle} />

          <div className="my-8 flex justify-center gap-4 lg:justify-start">
            <Suspense fallback={<SkeletonButton className="w-10" />}>
              <CollectionAction bottle={bottle} />
            </Suspense>

            <Button href={`/bottles/${bottle.id}/addTasting`} color="primary">
              Record a Tasting
            </Button>

            <ShareButton
              title={bottle.fullName}
              url={`/bottles/${bottle.id}`}
            />

            <ModActions bottle={bottle} />
          </div>
        </div>
      </Suspense>

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
