"use client";

import type { CatalogTargetV1 } from "@peated/server/schemas";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { useState } from "react";
import BottlePanel from "./bottlePanel";
import CatalogTargetIdentity from "./catalogTargetIdentity";
import { ClientOnly } from "./clientOnly";

export default function FlightTargetIdentity({
  target,
  flightId,
}: {
  target: CatalogTargetV1;
  flightId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <CatalogTargetIdentity
        target={target}
        compact
        onClick={
          target.kind === "bottle"
            ? (event) => {
                event.preventDefault();
                setOpen(true);
              }
            : undefined
        }
      />
      {target.kind === "bottle" && open && (
        <ClientOnly>
          {() => (
            <BottlePanel
              bottleId={target.bottle.id}
              tastingPath={getAddBottleHref({
                bottleId: target.bottle.id,
                flightId,
                intent: "tasting",
              })}
              open
              onClose={() => setOpen(false)}
            />
          )}
        </ClientOnly>
      )}
    </>
  );
}
