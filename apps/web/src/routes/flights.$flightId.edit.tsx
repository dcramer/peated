import FlightForm from "@peated/web/components/flightForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/flights/$flightId/edit")({
  component: Page,
});

function Page() {
  const { flightId } = Route.useParams();
  const orpc = useORPC();
  const { data: flight } = useSuspenseQuery(
    orpc.flights.details.queryOptions({
      input: { flight: flightId },
    })
  );

  const { data: bottles } = useSuspenseQuery(
    orpc.bottles.list.queryOptions({
      input: { flight: flightId },
    })
  );

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const flightUpdateMutation = useMutation(
    orpc.flights.update.mutationOptions({
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
              : oldData
        );
      },
    })
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
            onSuccess: () => navigate({ to: `/flights/${flight.id}` }),
          }
        );
      }}
      initialData={{ ...flight, bottles: bottles.results }}
      title="Edit Flight"
    />
  );
}
