"use client";

import { FlightOverlay } from "@peated/web/components/designSystem/product/flightOverlay.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { use } from "react";

export default function Page(props: { params: Promise<{ flightId: string }> }) {
  const { flightId } = use(props.params);
  const orpc = useORPC();
  const { data: flight } = useSuspenseQuery(
    orpc.flights.details.queryOptions({ input: { flight: flightId } }),
  );

  return (
    <FlightOverlay
      bottles={flight.bottles}
      description={flight.description}
      flightId={flight.id}
      name={flight.name}
    />
  );
}
