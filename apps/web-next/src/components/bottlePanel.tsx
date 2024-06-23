"use client";

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { type Bottle } from "@peated/server/types";
import { Suspense, type ComponentPropsWithoutRef } from "react";
import useAuth from "../hooks/useAuth";
import { trpc } from "../lib/trpc";
import BottleHeader from "./bottleHeader";
import BottleOverview from "./bottleOverview";
import BottlePriceHistory from "./bottlePriceHistory";
import Button from "./button";
import { ClientOnly } from "./clientOnly";
import CollectionAction from "./collectionAction";
import QRCodeClient from "./qrcode.client";
import ShareButton from "./shareButton";
import SidePanel, { SidePanelHeader } from "./sidePanel";
import SkeletonButton from "./skeletonButton";
import Spinner from "./spinner";

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
          ? (Math.round(bottle.avgRating * 100) / 100).toFixed(2)
          : "",
    },
    { name: "Tastings", value: bottle.totalTastings.toLocaleString() },
  ];

  return (
    <SidePanel {...props}>
      <SidePanelHeader title="Bottle Details">
        <BottleHeader bottle={bottle} href={`/bottles/${bottle.id}`} />
      </SidePanelHeader>

      <div className="my-6 flex items-start">
        <div className="h-auto flex-1 lg:w-10/12 lg:flex-auto">
          <div className="flex justify-center gap-4 px-4 lg:justify-start lg:px-0">
            <Suspense fallback={<SkeletonButton className="w-10" />}>
              <CollectionAction bottle={bottle} />
            </Suspense>

            <Button
              href={tastingPath ?? `/bottles/${bottle.id}/addTasting`}
              color="primary"
            >
              Record a Tasting
            </Button>

            <ShareButton
              title={bottle.fullName}
              url={`/bottles/${bottle.id}`}
            />

            <Button
              href={`/bottles/${bottle.id}`}
              icon={
                <ArrowTopRightOnSquareIcon
                  className="-mr-0.5 h-5 w-5"
                  aria-hidden="true"
                />
              }
            />
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
                <ClientOnly
                  fallback={<div className="h-[45px] animate-pulse" />}
                >
                  {() => <BottlePriceHistory bottleId={bottle.id} />}
                </ClientOnly>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden lg:block lg:w-2/12">
          <ClientOnly>
            {() => (
              <QRCodeClient
                value={`${window.location.protocol}//${window.location.host}${tastingPath}`}
              />
            )}
          </ClientOnly>
        </div>
      </div>
      {isLoading ? <Spinner /> : data ? <BottleOverview bottle={data} /> : null}
    </SidePanel>
  );
}
