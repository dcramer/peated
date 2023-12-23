import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Layout from "@peated/web/components/layout";
import ListItem from "@peated/web/components/listItem";
import { type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/server-runtime";
import { type SitemapFunction } from "remix-sitemap";
import PageHeader from "../components/pageHeader";
import { redirectToAuth } from "../lib/auth";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, context: { trpc, user } }) => {
    if (!user) return redirectToAuth({ request });

    return json({
      flightList: await trpc.flightList.query(),
    });
  },
);

export const meta: MetaFunction = () => {
  return [
    {
      title: "Flights",
    },
  ];
};

export default function Flights() {
  const { flightList } = useLoaderData<typeof loader>();

  if (!flightList) return <div>Error</div>;

  const { results, rel } = flightList;

  return (
    <Layout>
      <PageHeader
        title="Flights"
        metadata={
          <Button color="primary" to="/addFlight">
            Add Flight
          </Button>
        }
      />
      <div className="divide-y divide-slate-800 sm:rounded">
        {results.length ? (
          results.map((flight) => {
            return (
              <ListItem key={flight.id} as={Link} to={`/flights/${flight.id}`}>
                <div className="flex flex-auto items-center space-x-4">
                  <div className="flex-auto space-y-1 font-medium group-hover:underline">
                    {flight.name || <em>unknown flight</em>}
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
      </div>
      {rel && (
        <nav
          className="flex items-center justify-between py-3"
          aria-label="Pagination"
        >
          <div className="flex flex-auto justify-between gap-x-2 sm:justify-end">
            <Button
              to={rel.prevCursor ? `?cursor=${rel.prevCursor}` : undefined}
              disabled={!rel.prevCursor}
            >
              Previous
            </Button>
            <Button
              to={rel.nextCursor ? `?cursor=${rel.nextCursor}` : undefined}
              disabled={!rel.nextCursor}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </Layout>
  );
}
