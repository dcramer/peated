import { type Bottle } from "@peated/server/types";
import { Link } from "@remix-run/react";
import { useState, type ComponentPropsWithoutRef } from "react";
import BottlePanel from "./bottlePanel";
import { ClientOnly } from "./clientOnly";

type Props = Omit<ComponentPropsWithoutRef<typeof Link>, "to"> & {
  to?: string;
  bottle: Bottle;
  flightId?: string;
};

export default function BottleLink({ bottle, flightId, ...props }: Props) {
  const [open, setOpen] = useState(false);

  const tastingPath = flightId
    ? `/bottles/${bottle.id}/addTasting?flight=${flightId}`
    : `/bottles/${bottle.id}/addTasting`;

  return (
    <>
      <Link
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        title={bottle.fullName}
        className="absolute inset-0"
        to={`/bottles/${bottle.id}`}
        {...props}
      />
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
    </>
  );
}
