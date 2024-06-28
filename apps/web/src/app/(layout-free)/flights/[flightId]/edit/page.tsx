"use client";

import FlightForm from "@peated/web/components/flightForm";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export const fetchCache = "default-no-store";

export const dynamic = "force-dynamic";

export default function Page({
  params: { flightId },
}: {
  params: { flightId: string };
}) {
  const [[flight, bottles]] = trpc.useSuspenseQueries((t) => [
    t.flightById(flightId),
    t.bottleList({
      flight: flightId,
    }),
  ]);

  const router = useRouter();

  const trpcUtils = trpc.useUtils();

  const flightUpdateMutation = trpc.flightUpdate.useMutation({
    onSuccess: (data) => {
      if (!data) return;
      const previous = trpcUtils.flightById.getData(data.id);
      if (previous) {
        trpcUtils.flightById.setData(data.id, {
          ...previous,
          ...data,
        });
      }
    },
  });

  return (
    <FlightForm
      onSubmit={async (data) => {
        await flightUpdateMutation.mutateAsync(
          {
            flight: flight.id,
            ...data,
          },
          {
            onSuccess: () => router.push(`/flights/${flight.id}`),
          },
        );
      }}
      initialData={{ ...flight, bottles: bottles.results }}
      title="Edit Flight"
    />
  );
}
