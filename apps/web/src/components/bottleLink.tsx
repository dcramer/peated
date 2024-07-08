"use client";

import { type Bottle } from "@peated/server/types";
import Link from "@peated/web/components/link";
import { useState, type ComponentPropsWithoutRef } from "react";
import BottlePanel from "./bottlePanel";
import { ClientOnly } from "./clientOnly";

type Props = Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & {
  href?: string;
  bottle: Bottle;
  withPanel?: boolean;
  flightId?: string;
};

export default function BottleLink({
  bottle,
  flightId,
  withPanel = false,
  ...props
}: Props) {
  const [open, setOpen] = useState(false);

  const tastingPath = flightId
    ? `/bottles/${bottle.id}/addTasting?flight=${flightId}`
    : `/bottles/${bottle.id}/addTasting`;

  return (
    <>
      <Link
        onClick={(e) => {
          if (withPanel) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        title={bottle.fullName}
        className="absolute inset-0"
        href={`/bottles/${bottle.id}`}
        {...props}
      />
      {withPanel && (
        <ClientOnly>
          {() => (
            <BottlePanel
              tastingPath={tastingPath}
              bottle={bottle}
              open={open}
              onClose={() => {
                setOpen(false);
              }}
            />
          )}
        </ClientOnly>
      )}
    </>
  );
}
