"use client";
import { use } from "react";

import FlightForm from "@peated/web/components/flightForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { formQueryOptions } from "@peated/web/lib/orpc/query";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page(props: { params: Promise<{ flightId: string }> }) {
  const params = use(props.params);

  const { flightId } = params;

  const orpc = useORPC();
  const { data: flight } = useSuspenseQuery(
    formQueryOptions(
      orpc.flights.details.queryOptions({
        input: { flight: flightId },
      }),
    ),
  );

  const router = useRouter();
  const queryClient = useQueryClient();

  const flightUpdateMutation = useMutation(
    orpc.flights.update.mutationOptions({
      onSuccess: (data) => {
        if (!data) return;
        return queryClient.invalidateQueries({
          queryKey: orpc.flights.details.key({
            input: { flight: data.id },
          }),
          exact: true,
        });
      },
    }),
  );

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
      initialData={flight}
      title="Edit Flight"
    />
  );
}
