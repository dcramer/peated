import BottleHeader from "@peated/web/components/bottleHeader";
import Button from "@peated/web/components/button";
import CollectionAction from "@peated/web/components/collectionAction";
import FlavorProfile from "@peated/web/components/flavorProfile";
import ShareButton from "@peated/web/components/shareButton";
import SkeletonButton from "@peated/web/components/skeletonButton";
import { summarize } from "@peated/web/lib/markdown";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import type { Product, WithContext } from "schema-dts";
import ModActions from "./modActions";

export default async function Layout(props: {
  params: Promise<Record<string, any>>;
  children: ReactNode;
}) {
  const params = await props.params;

  const { children } = props;

  const bottleId = Number(params.bottleId);
  const trpcClient = await getTrpcClient();
  const bottle = await trpcClient.bottleById.fetch(bottleId);

  // tombstone path - redirect to the absolute url to ensure search engines dont get mad
  if (bottle.id !== bottleId) {
    // const newPath = pathname.replace(
    //   `/bottles/${bottleId}`,
    //   `/bottles/${bottle.id}`,
    // );
    // TODO: this should redirect to subpath
    return redirect(`/bottles/${bottle.id}/`);
  }

  const jsonLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: bottle.fullName,
    image: bottle.imageUrl ?? undefined,
    description: summarize(bottle.description || "", 200),
    brand: {
      "@type": "Brand",
      name: bottle.brand?.name,
    },
    aggregateRating: bottle.totalTastings
      ? {
          "@type": "AggregateRating",
          ratingValue: bottle.avgRating ?? 0,
          reviewCount: bottle.totalTastings ?? 0,
        }
      : undefined,
    offers: bottle.lastPrice
      ? {
          "@type": "AggregateOffer",
          offerCount: 1,
          lowPrice: bottle.lastPrice?.price,
          highPrice: bottle.lastPrice?.price,
          priceCurrency: bottle.lastPrice?.currency,
        }
      : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="w-full p-3 lg:py-0">
        <BottleHeader bottle={bottle} />

        <div className="my-8 flex flex-col justify-center gap-2 sm:flex-row lg:justify-start">
          <div className="flex flex-grow justify-center gap-4 gap-x-2 lg:justify-start">
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
          <div className="inline-flex flex-col items-center justify-center space-x-1 truncate sm:flex-row sm:items-start">
            {!!bottle.flavorProfile && (
              <FlavorProfile profile={bottle.flavorProfile} />
            )}
          </div>
        </div>
      </div>

      {children}
    </>
  );
}
