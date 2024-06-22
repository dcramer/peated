"use client";

import useAuthRequired from "@peated/web-next/hooks/useAuthRequired";
import FlightForm from "@peated/web/components/flightForm";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export default function AddFlight() {
  useAuthRequired();

  const router = useRouter();
  const flightCreateMutation = trpc.flightCreate.useMutation();

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
