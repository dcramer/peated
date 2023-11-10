import { useNavigate } from "@remix-run/react";

import { type LoaderFunction, type MetaFunction } from "@remix-run/node";
import type { SitemapFunction } from "remix-sitemap";
import FlightForm from "~/components/flightForm";
import { redirectToAuth } from "~/lib/auth.server";
import { trpc } from "~/lib/trpc";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const loader: LoaderFunction = ({ request, context }) => {
  if (!context.user) return redirectToAuth({ request });

  return null;
};

export const meta: MetaFunction = () => {
  return [
    {
      title: "Add Flight",
    },
  ];
};

export default function AddFlight() {
  const navigate = useNavigate();
  const flightCreateMutation = trpc.flightCreate.useMutation();

  return (
    <FlightForm
      onSubmit={async (data) => {
        const newFlight = await flightCreateMutation.mutateAsync(data);
        navigate(`/flights/${newFlight.id}`);
      }}
      title="Create Flight"
    />
  );
}
