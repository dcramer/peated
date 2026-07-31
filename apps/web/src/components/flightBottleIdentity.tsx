"use client";

import type { Bottle } from "@peated/server/types";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { useState } from "react";
import BottleIdentity from "./bottleIdentity";
import BottlePanel from "./bottlePanel";
import { ClientOnly } from "./clientOnly";

export default function FlightBottleIdentity({
  bottle,
  flightId,
}: {
  bottle: Bottle;
  flightId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <BottleIdentity
        bottle={bottle}
        mode="absolute"
        metadataVariant="summary"
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      />
      {open && (
        <ClientOnly>
          {() => (
            <BottlePanel
              bottleId={bottle.id}
              tastingPath={getAddBottleHref({
                bottleId: bottle.id,
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
