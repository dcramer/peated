import { type Bottle } from "@peated/server/types";
import { type ComponentPropsWithoutRef } from "react";
import useAuth from "../hooks/useAuth";
import { trpc } from "../lib/trpc";
import BottleHeader from "./bottleHeader";
import BottleOverview from "./bottleOverview";
import BottlePriceHistory from "./bottlePriceHistory.client";
import Button from "./button";
import { ClientOnly } from "./clientOnly";
import CollectionAction from "./collectionAction";
import LoadingIndicator from "./loadingIndicator";
import QueryBoundary from "./queryBoundary";
import ShareButton from "./shareButton";
import SidePanel, { SidePanelHeader } from "./sidePanel";
import SkeletonButton from "./skeletonButton";

export default function BottlePanel({
  bottle,
  tastingPath,
  ...props
}: {
  bottle: Bottle;
  tastingPath?: string;
} & Omit<ComponentPropsWithoutRef<typeof SidePanel>, "children">) {
  const { user } = useAuth();

  const { data, isLoading } = trpc.bottleById.useQuery(bottle.id);

  const stats = [
    {
      name: "Avg Rating",
      value:
        bottle.avgRating !== null
          ? Math.round(bottle.avgRating * 100) / 100
          : "",
    },
    { name: "Tastings", value: bottle.totalTastings.toLocaleString() },
  ];

  return (
    <SidePanel {...props}>
      <SidePanelHeader>
        <BottleHeader bottle={bottle} to={`/bottles/${bottle.id}`} />
      </SidePanelHeader>

      <div className="my-8 flex justify-center gap-4 lg:justify-start">
        {user && (
          <QueryBoundary
            loading={<SkeletonButton className="w-10" />}
            fallback={() => null}
          >
            <CollectionAction bottle={bottle} />
          </QueryBoundary>
        )}

        <Button
          to={tastingPath ?? `/bottles/${bottle.id}/addTasting`}
          color="primary"
        >
          Record a Tasting
        </Button>

        <ShareButton title={bottle.fullName} url={`/bottles/${bottle.id}`} />
      </div>

      <div className="my-6 grid grid-cols-3 items-center gap-3 text-center lg:grid-cols-4 lg:text-left">
        {stats.map((stat) => (
          <div key={stat.name}>
            <div className="text-light leading-7">{stat.name}</div>
            <div className="order-first text-3xl font-semibold tracking-tight lg:text-5xl">
              {stat.value || "-"}
            </div>
          </div>
        ))}
        <div className="hidden lg:block">
          <div className="text-light leading-7">Price</div>
          <div className="flex items-center">
            <ClientOnly fallback={<div className="h-[45px] animate-pulse" />}>
              {() => <BottlePriceHistory bottleId={bottle.id} />}
            </ClientOnly>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingIndicator />
      ) : data ? (
        <BottleOverview bottle={data} />
      ) : null}
    </SidePanel>
  );
}
