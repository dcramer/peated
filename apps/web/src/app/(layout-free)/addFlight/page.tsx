"use client";

import FlightForm from "@peated/web/components/flightForm";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

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
