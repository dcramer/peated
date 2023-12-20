import { type Bottle } from "@peated/server/types";
import BottleIcon from "@peated/web/components/assets/Bottle";
import { Link } from "@remix-run/react";
import { type ComponentPropsWithoutRef } from "react";
import useAuth from "../hooks/useAuth";
import { formatCategoryName } from "../lib/strings";
import BottleMetadata from "./bottleMetadata";
import BottlePriceHistory from "./bottlePriceHistory";
import Button from "./button";
import { ClientOnly } from "./clientOnly";
import CollectionAction from "./collectionAction";
import PageHeader from "./pageHeader";
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
        <PageHeader
          icon={BottleIcon}
          title={bottle.fullName}
          titleExtra={
            <BottleMetadata
              data={bottle}
              className="w-full truncate text-center text-slate-500 lg:text-left"
            />
          }
          metadata={
            (bottle.category || bottle.statedAge) && (
              <div className="flex w-full min-w-[150px] flex-col items-center justify-center gap-x-1 text-slate-500 lg:w-auto lg:items-end">
                <div>
                  {bottle.category && (
                    <Link
                      to={`/bottles?category=${encodeURIComponent(
                        bottle.category,
                      )}`}
                    >
                      {formatCategoryName(bottle.category)}
                    </Link>
                  )}
                </div>
                <div>
                  {bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}
                </div>
              </div>
            )
          }
        />
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
    </SidePanel>
  );
}
