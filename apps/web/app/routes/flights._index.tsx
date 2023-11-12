import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { type SitemapFunction } from "remix-sitemap";
import Button from "~/components/button";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import ListItem from "~/components/listItem";
import SimpleHeader from "~/components/simpleHeader";
import { redirectToAuth } from "~/lib/auth.server";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({
  request,
  context: { user, trpc },
}: LoaderFunctionArgs) {
  if (!user) return redirectToAuth({ request });

  return json({
    flightList: await trpc.flightList.query(),
  });
}

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
      <SimpleHeader>Flights</SimpleHeader>
      <ul className="divide-y divide-slate-800 sm:rounded">
        {results.length ? (
          results.map((flight) => {
            return (
              <ListItem key={flight.id}>
                <div className="flex flex-auto items-center space-x-4">
                  <div className="flex-auto space-y-1 font-medium">
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
