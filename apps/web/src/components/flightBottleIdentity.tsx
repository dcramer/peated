"use client";

import type { Bottle } from "@peated/server/types";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { useState } from "react";
import BottlePanel from "./bottlePanel";
import { ClientOnly } from "./clientOnly";
import Link from "./link";

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
      <Link
        href={`/bottles/${bottle.id}`}
        className="font-semibold hover:underline"
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        {bottle.fullName}
      </Link>
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
