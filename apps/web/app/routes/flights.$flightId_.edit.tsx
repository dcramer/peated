import Spinner from "@peated/web/components/spinner";
import { trpc } from "@peated/web/lib/trpc";
import { type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import invariant from "tiny-invariant";
import FlightForm from "../components/flightForm";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const meta: MetaFunction = () => {
  return [
    {
      title: "Edit Flight",
    },
  ];
};

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { flightId }, context: { trpc } }) => {
    invariant(flightId);

    const [flight, bottles] = await Promise.all([
      trpc.flightById.query(flightId),
      trpc.bottleList.query({
        flight: flightId,
      }),
    ]);

    return json({ flight, bottles });
  },
);

export default function EditFlight() {
  const { flight, bottles } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  if (!flight) return <Spinner />;

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
            onSuccess: () => navigate(`/flights/${flight.id}`),
          },
        );
      }}
      initialData={{ ...flight, bottles: bottles.results }}
      title="Edit Flight"
    />
  );
}
