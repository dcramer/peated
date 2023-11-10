import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import BottleCard from "~/components/bottleCard";
import Layout from "~/components/layout";
import { summarize } from "~/lib/markdown";

export async function loader({
  params: { flightId },
  context: { trpc },
}: LoaderFunctionArgs) {
  invariant(flightId);

  return json({
    flight: await trpc.flightById.query(flightId),
    bottles: await trpc.bottleList.query({
      flight: flightId,
    }),
  });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  const description = summarize(data.flight.description || "", 200);

  return [
    {
      title: data.flight.name,
    },
    {
      name: "description",
      content: description,
    },
    {
      property: "og:title",
      content: data.flight.name,
    },
    {
      property: "og:description",
      content: description,
    },
    {
      property: "twitter:card",
      content: "product",
    },
  ];
};

export default function FlightDetails() {
  const { flight, bottles } = useLoaderData<typeof loader>();

  return (
    <Layout>
      <div className="my-4 flex min-w-full flex-wrap gap-x-3 gap-y-4 p-3 sm:flex-nowrap sm:py-0">
        <div className="w-full flex-auto flex-col items-center space-y-1 sm:w-auto sm:items-start">
          <h1 className="mb-2 truncate text-center text-3xl font-semibold leading-7 sm:text-left">
            {flight.name}
          </h1>
          {flight.description && (
            <div className="truncate text-center text-slate-500 sm:text-left">
              {flight.description}
            </div>
          )}
        </div>
      </div>
      {bottles.results.map((b) => (
        <BottleCard key={b.id} bottle={b} />
      ))}
    </Layout>
  );
}
