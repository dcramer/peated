import { summarize } from "@peated/web/lib/markdown";
import type { MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import BottleLink from "../components/bottleLink";
import { Distillers } from "../components/bottleMetadata";
import { ClientOnly } from "../components/clientOnly";
import LayoutSplash from "../components/layoutSplash";
import QRCodeClient from "../components/qrcode.client";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { flightId }, context: { queryUtils } }) => {
    invariant(flightId);

    const [flight, bottles] = await Promise.all([
      queryUtils.flightById.ensureData(flightId),
      queryUtils.bottleList.ensureData({
        flight: flightId,
      }),
    ]);

    return {
      flight,
      bottles,
    };
  },
);

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
    <LayoutSplash fullWidth>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex min-w-full flex-wrap gap-x-3 gap-y-4 p-3 sm:flex-nowrap sm:py-0">
          <div className="w-full flex-auto flex-col items-center space-y-1 sm:w-auto sm:items-start">
            <h1 className="mb-2 text-center text-4xl font-semibold sm:text-left">
              {flight.name}
            </h1>
            {flight.description && (
              <div className="text-light text-center sm:text-left">
                {flight.description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center">
          <div className="w-full lg:w-8/12">
            <table className="min-w-full">
              <tbody>
                {bottles.results.map((bottle) => {
                  return (
                    <tr key={bottle.id} className="border-b border-slate-800">
                      <td className="group relative max-w-0 py-4 pl-4 pr-3 sm:pl-3">
                        <BottleLink
                          bottle={bottle}
                          flightId={flight.id}
                          className="absolute inset-0"
                        />
                        <div className="flex items-center gap-x-1 text-2xl group-hover:underline">
                          <div className="font-semibold">{bottle.fullName}</div>
                        </div>
                        <div className="text-light flex flex-row items-start space-x-1 truncate">
                          <Distillers data={bottle} />
                        </div>
                        {bottle.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="hidden p-4 pl-12 lg:block lg:w-4/12">
            <ClientOnly>
              {() => (
                <QRCodeClient
                  value={`${window.location.protocol}//${window.location.host}/flights/${flight.id}`}
                />
              )}
            </ClientOnly>
          </div>
        </div>
      </div>
    </LayoutSplash>
  );
}
