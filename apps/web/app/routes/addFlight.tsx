import { useNavigate } from "@remix-run/react";

import { type LoaderFunction, type MetaFunction } from "@remix-run/node";
import type { SitemapFunction } from "remix-sitemap";
import FlightForm from "~/components/flightForm";
import useApi from "~/hooks/useApi";
import { redirectToAuth } from "~/lib/auth.server";

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
  const api = useApi();
  const navigate = useNavigate();

  return (
    <FlightForm
      onSubmit={async (data) => {
        const newFlight = await api.post(`/flights`, { data });
        navigate(`/flights/${newFlight.id}`);
      }}
      title="Create Flight"
    />
  );
}
