"use client";

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { type Bottle } from "@peated/server/types";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, type ComponentPropsWithoutRef } from "react";
import { useORPC } from "../lib/orpc/context";
import BottleHeader from "./bottleHeader";
import BottleOverview from "./bottleOverview";
import BottleStats from "./bottleStats";
import Button from "./button";
import { ClientOnly } from "./clientOnly";
import CollectionAction from "./collectionAction";
import QRCodeClient from "./qrcode.client";
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
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: bottle.id } }),
  );

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

          <BottleStats bottle={data} />
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
      <BottleOverview bottle={data} />
    </SidePanel>
  );
}
