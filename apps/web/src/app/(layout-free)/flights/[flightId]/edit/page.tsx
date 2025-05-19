"use client";

import FlightForm from "@peated/web/components/flightForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page({
  params: { flightId },
}: {
  params: { flightId: string };
}) {
  const orpc = useORPC();
  const { data: flight } = useSuspenseQuery(
    orpc.flights.details.queryOptions({
      input: { flight: flightId },
    }),
  );

  const { data: bottles } = useSuspenseQuery(
    orpc.bottles.list.queryOptions({
      input: { flight: flightId },
    }),
  );

  const router = useRouter();
  const queryClient = useQueryClient();

  const flightUpdateMutation = useMutation({
    ...orpc.flights.update.mutationOptions(),
    onSuccess: (data) => {
      if (!data) return;
      // TODO: this might be wrong
      queryClient.setQueryData(
        orpc.flights.details.key({
          input: { flight: data.id },
        }),
        (oldData: any) =>
          oldData
            ? {
                ...oldData,
                ...data,
              }
            : oldData,
      );
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
