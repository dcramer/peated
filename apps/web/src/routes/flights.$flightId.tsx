import { CheckBadgeIcon } from "@heroicons/react/20/solid";
import { ArrowsPointingOutIcon, StarIcon } from "@heroicons/react/24/outline";
import { formatCategoryName } from "@peated/server/lib/format";
import BottleLink from "@peated/web/components/bottleLink";
import Button from "@peated/web/components/button";
import ModActions from "@peated/web/components/flights/modActions";
import { summarize } from "@peated/web/lib/markdown";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  flight: z.string().optional(),
});

export const Route = createFileRoute("/flights/$flightId")({
  component: Page,
  validateSearch: searchSchema,
  loader: async ({ params, context }) => {
    const flight = await context.queryClient.ensureQueryData(
      context.orpc.flights.details.queryOptions({
        input: {
          flight: params.flightId,
        },
      })
    );

    return { flight };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};

    const { flight } = loaderData;
    const description = summarize(flight.description || "", 200);

    return {
      meta: [
        {
          title: `${flight.name} - Flight Details`,
        },
        {
          name: "description",
          content: description,
        },
      ],
    };
  },
});

function Page() {
  const { flight } = Route.useLoaderData();
  const orpc = useORPC();
  const { data: bottleList } = useSuspenseQuery(
    orpc.bottles.list.queryOptions({
      input: {
        flight: flight.id,
      },
    })
  );

  return (
    <>
      <div className="my-4 flex min-w-full flex-wrap gap-x-3 gap-y-4 p-3 sm:flex-nowrap sm:py-0">
        <div className="w-full flex-auto flex-col items-center space-y-1 sm:w-auto sm:items-start">
          <div className="mb-2 flex flex-col items-center gap-4 sm:flex-row">
            <h1 className="truncate text-center font-semibold text-3xl leading-7 sm:text-left">
              {flight.name}
            </h1>
            <div className="flex flex-row gap-2">
              <Button to={`/flights/${flight.id}/overlay`} color="primary">
                <ArrowsPointingOutIcon className="h-4 w-4" />
              </Button>
              <ModActions flight={flight} />
            </div>
          </div>
          {flight.description && (
            <div className="truncate text-center text-muted sm:text-left">
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
              <tr key={bottle.id} className="border-slate-800 border-b">
                <td className="group relative max-w-0 py-4 pr-3 pl-4 text-sm sm:pl-3">
                  <BottleLink
                    bottle={bottle}
                    flightId={flight.id}
                    className="absolute inset-0"
                    withPanel
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
                  <div className="text-muted text-sm">
                    {formatCategoryName(bottle.category)}
                  </div>
                </td>
                <td className="hidden py-4 pr-4 pl-3 text-right text-sm sm:table-cell sm:pr-3">
                  <Button
                    color={bottle.hasTasted ? "default" : "highlight"}
                    size="small"
                    to="/bottles/$bottleId/addTasting"
                    params={{
                      bottleId: String(bottle.id),
                    }}
                    search={(prev) => ({
                      ...prev,
                      flight: flight.id,
                    })}
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
