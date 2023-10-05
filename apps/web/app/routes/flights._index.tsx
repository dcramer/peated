import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";

import Layout from "~/components/layout";
import { redirectToAuth } from "~/lib/auth.server";

import { json } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";

import Button from "~/components/button";
import EmptyActivity from "~/components/emptyActivity";
import ListItem from "~/components/listItem";
import LoadingIndicator from "~/components/loadingIndicator";
import SimpleHeader from "~/components/simpleHeader";
import useApi from "~/hooks/useApi";
import { fetchFlights } from "~/queries/flights";
import { fetchFriends } from "~/queries/friends";

export async function loader({ context }: LoaderArgs) {
  if (!context.user) return redirectToAuth({ request });

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(["friends"], () => fetchFriends(context.api));

  return json({ dehydratedState: dehydrate(queryClient) });
}

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Flights",
    },
  ];
};

export default function Friends() {
  const api = useApi();

  const { data, isLoading } = useQuery(["flights"], () => fetchFlights(api), {
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingIndicator />;

  if (!data) return <div>Error</div>;

  const { results, rel } = data;

  return (
    <Layout>
      <SimpleHeader>Flights</SimpleHeader>
      <ul className="divide-y divide-slate-800 sm:rounded">
        {results.length ? (
          results.map((flight) => {
            return (
              <ListItem key={flight.id}>
                <div className="flex flex-1 items-center space-x-4">
                  <div className="flex-1 space-y-1 font-medium">
                    <Link
                      to={`/flights/${flight.id}`}
                      className="hover:underline"
                    >
                      {flight.name}
                    </Link>
                  </div>
                  {flight.description && (
                    <div className="text-light text-sm">
                      {flight.description}
                    </div>
                  )}
                </div>
              </ListItem>
            );
          })
        ) : (
          <EmptyActivity to={`/addFlight`}>
            <span className="text-light mb-4 block">
              Flights allow you to create a record of a set of tastings, either
              for yourself, or to make it easy to share with friends.
            </span>

            <Button color="highlight">Create a Flight</Button>
          </EmptyActivity>
        )}
      </ul>
      {rel && (
        <nav
          className="flex items-center justify-between py-3"
          aria-label="Pagination"
        >
          <div className="flex flex-1 justify-between gap-x-2 sm:justify-end">
            <Button
              to={rel.prevPage ? `?page=${rel.prevPage}` : undefined}
              disabled={!rel.prevPage}
            >
              Previous
            </Button>
            <Button
              to={rel.nextPage ? `?page=${rel.nextPage}` : undefined}
              disabled={!rel.nextPage}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </Layout>
  );
}
