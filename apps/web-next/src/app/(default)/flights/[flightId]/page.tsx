import { CheckBadgeIcon } from "@heroicons/react/20/solid";
import { ArrowsPointingOutIcon, StarIcon } from "@heroicons/react/24/outline";
import { formatCategoryName } from "@peated/server/src/lib/format";
import BottleLink from "@peated/web/components/bottleLink";
import Button from "@peated/web/components/button";
import { summarize } from "@peated/web/lib/markdown";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import ModActions from "./modActions";

export async function generateMetadata({
  params: { flightId },
}: {
  params: { flightId: string };
}) {
  const trpcClient = await getTrpcClient();
  const flight = await trpcClient.flightById.ensureData(flightId);
  const description = summarize(flight.description || "", 200);

  return {
    title: `${flight.name} - Flight Details`,
    description,
  };
}

export default async function Page({
  params: { flightId },
}: {
  params: { flightId: string };
}) {
  const trpcClient = await getTrpcClient();
  const [flight, bottleList] = await Promise.all([
    trpcClient.flightById.ensureData(flightId),
    trpcClient.bottleList.ensureData({
      flight: flightId,
    }),
  ]);

  return (
    <>
      <div className="my-4 flex min-w-full flex-wrap gap-x-3 gap-y-4 p-3 sm:flex-nowrap sm:py-0">
        <div className="w-full flex-auto flex-col items-center space-y-1 sm:w-auto sm:items-start">
          <div className="mb-2 flex items-center gap-4">
            <h1 className="truncate text-center text-3xl font-semibold leading-7 sm:text-left">
              {flight.name}
            </h1>
            <Button href={`/flights/${flight.id}/overlay`} color="primary">
              <ArrowsPointingOutIcon className="h-4 w-4" />
            </Button>
            <ModActions flight={flight} />
          </div>
          {flight.description && (
            <div className="text-light truncate text-center sm:text-left">
              {flight.description}
            </div>
          )}
        </div>
      </div>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-4/6" />
          <col className="hidden sm:w-2/6" />
        </colgroup>
        <tbody>
          {bottleList.results.map((bottle) => {
            return (
              <tr key={bottle.id} className="border-b border-slate-800">
                <td className="group relative max-w-0 py-4 pl-4 pr-3 text-sm sm:pl-3">
                  <BottleLink
                    bottle={bottle}
                    flightId={flight.id}
                    className="absolute inset-0"
                  />
                  <div className="flex items-center gap-x-1 group-hover:underline">
                    <div className="font-semibold">{bottle.fullName}</div>
                    {bottle.isFavorite && (
                      <StarIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                    {bottle.hasTasted && (
                      <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>
                  <div className="text-light text-sm">
                    {formatCategoryName(bottle.category)}
                  </div>
                </td>
                <td className="hidden py-4 pl-3 pr-4 text-right text-sm sm:table-cell sm:pr-3">
                  <Button
                    color={bottle.hasTasted ? "default" : "highlight"}
                    size="small"
                    href={`/bottles/${bottle.id}/addTasting?flight=${flight.id}`}
                  >
                    Record Tasting
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
