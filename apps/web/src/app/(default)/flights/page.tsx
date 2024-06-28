import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import ListItem from "@peated/web/components/listItem";
import PaginationButtons from "@peated/web/components/paginationButtons";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import type { Metadata } from "next";

export const fetchCache = "default-no-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Flights",
};

export default async function Page() {
  if (!(await isLoggedIn())) {
    return redirectToAuth({ pathname: "/favorites" });
  }
  const trpcClient = await getTrpcClient();
  const flightList = await trpcClient.flightList.ensureData();

  return (
    <>
      <div className="divide-y divide-slate-800 sm:rounded">
        {flightList.results.length ? (
          flightList.results.map((flight) => {
            return (
              <ListItem
                key={flight.id}
                as={Link}
                href={`/flights/${flight.id}`}
              >
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
          <EmptyActivity href={`/addFlight`}>
            <span className="text-light mb-4 block">
              Flights allow you to create a record of a set of tastings, either
              for yourself, or to make it easy to share with friends.
            </span>

            <Button color="highlight">Create a Flight</Button>
          </EmptyActivity>
        )}
      </div>
      <PaginationButtons rel={flightList.rel} />
    </>
  );
}
