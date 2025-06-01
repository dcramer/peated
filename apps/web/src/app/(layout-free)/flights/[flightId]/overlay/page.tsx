"use client";

import BottleLink from "@peated/web/components/bottleLink";
import { Distillers } from "@peated/web/components/bottleMetadata";
import { ClientOnly } from "@peated/web/components/clientOnly";
import LayoutEmpty from "@peated/web/components/layoutEmpty";
import QRCodeClient from "@peated/web/components/qrcode.client";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page({
  params: { flightId },
}: {
  params: { flightId: string };
}) {
  const orpc = useORPC();

  // TODO: we'd like to use `useSuspenseQueries`, but oRPC has an issue atm:
  // https://github.com/unnoq/orpc/issues/519
  const { data: flight } = useSuspenseQuery(
    orpc.flights.details.queryOptions({
      input: { flight: flightId },
    })
  );
  const { data: bottleList } = useSuspenseQuery(
    orpc.bottles.list.queryOptions({
      input: { flight: flightId },
    })
  );

  return (
    <LayoutEmpty fullWidth>
      <div className="w-full max-w-3xl flex-1 self-center">
        <div className="mb-8 flex min-w-full flex-wrap gap-x-3 gap-y-4 p-3 sm:flex-nowrap sm:py-0">
          <div className="w-full flex-auto flex-col items-center space-y-1 sm:w-auto sm:items-start">
            <h1 className="mb-2 text-center text-4xl font-semibold sm:text-left">
              {flight.name}
            </h1>
            {flight.description && (
              <div className="text-muted text-center sm:text-left">
                {flight.description}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center">
          <div className="w-full lg:w-8/12">
            <table className="min-w-full">
              <tbody>
                {bottleList.results.map((bottle) => {
                  return (
                    <tr key={bottle.id} className="border-b border-slate-800">
                      <td className="group relative max-w-0 py-4 pl-4 pr-3 sm:pl-3">
                        <BottleLink
                          bottle={bottle}
                          flightId={flight.id}
                          className="absolute inset-0"
                          withPanel
                        />
                        <div className="flex items-center gap-x-1 text-2xl group-hover:underline">
                          <div className="font-semibold">{bottle.fullName}</div>
                        </div>
                        <div className="text-muted flex flex-row items-start space-x-1 truncate">
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
    </LayoutEmpty>
  );
}
