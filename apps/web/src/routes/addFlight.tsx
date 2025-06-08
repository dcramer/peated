import FlightForm from "@peated/web/components/flightForm";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/addFlight")({
  component: AddFlight,
});

function AddFlight() {
  useAuthRequired();

  const navigate = useNavigate();
  const orpc = useORPC();
  const flightCreateMutation = useMutation(
    orpc.flights.create.mutationOptions()
  );

  return (
    <FlightForm
      onSubmit={async (data) => {
        const newFlight = await flightCreateMutation.mutateAsync(data);
        navigate({ to: `/flights/${newFlight.id}` });
      }}
      title="Create Flight"
    />
  );
}
