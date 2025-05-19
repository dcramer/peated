"use client";

import FlightForm from "@peated/web/components/flightForm";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function AddFlight() {
  useAuthRequired();

  const router = useRouter();
  const orpc = useORPC();
  const flightCreateMutation = useMutation(
    orpc.flights.create.mutationOptions(),
  );

  return (
    <FlightForm
      onSubmit={async (data) => {
        const newFlight = await flightCreateMutation.mutateAsync(data);
        router.push(`/flights/${newFlight.id}`);
      }}
      title="Create Flight"
    />
  );
}
