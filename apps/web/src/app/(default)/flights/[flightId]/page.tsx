"use client";
import { use } from "react";

import { ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import { formatCategoryName } from "@peated/server/lib/format";
import { BottleStatusIndicators } from "@peated/web/components/bottleStatusIcons";
import Button from "@peated/web/components/button";
import FlightTargetIdentity from "@peated/web/components/flightTargetIdentity";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import ModActions from "./modActions";

export default function Page(props: { params: Promise<{ flightId: string }> }) {
  const params = use(props.params);

  const { flightId } = params;

  const orpc = useORPC();
  const { data: flight } = useSuspenseQuery(
    orpc.flights.details.queryOptions({
      input: {
        flight: flightId,
      },
    }),
  );
  return (
    <>
      <div className="my-4 flex min-w-full flex-wrap gap-x-3 gap-y-4 p-3 sm:flex-nowrap sm:py-0">
        <div className="w-full flex-auto flex-col items-center space-y-1 sm:w-auto sm:items-start">
          <div className="mb-2 flex flex-col items-center gap-4 sm:flex-row">
            <h1 className="truncate text-center text-3xl font-semibold leading-7 sm:text-left">
              {flight.name}
            </h1>
            <div className="flex flex-row gap-2">
              <Button href={`/flights/${flight.id}/overlay`} color="primary">
                <ArrowsPointingOutIcon className="h-4 w-4" />
              </Button>
              <ModActions flight={flight} />
            </div>
          </div>
          {flight.description && (
            <div className="text-muted truncate text-center sm:text-left">
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
          {flight.targets.map((flightTarget) => {
            const { target } = flightTarget;
            const owner =
              target.kind === "bottle" ? target.bottle : target.group;
            return (
              <tr key={target.targetId} className="border-b border-slate-800">
                <td className="max-w-0 py-4 pl-4 pr-3 text-sm sm:pl-3">
                  <div className="flex items-center gap-x-1">
                    <FlightTargetIdentity
                      target={target}
                      flightId={flight.id}
                    />
                    <BottleStatusIndicators
                      hasTasted={flightTarget.hasTasted}
                      isLibrary={flightTarget.isLibrary}
                    />
                  </div>
                  <div className="text-muted text-sm">
                    {formatCategoryName(owner.category)}
                  </div>
                </td>
                <td className="hidden py-4 pl-3 pr-4 text-right text-sm sm:table-cell sm:pr-3">
                  {target.kind === "bottle" && (
                    <Button
                      color={flightTarget.hasTasted ? "default" : "highlight"}
                      size="small"
                      href={getAddBottleHref({
                        bottleId: target.bottle.id,
                        flightId: flight.id,
                        intent: "tasting",
                      })}
                    >
                      Log Tasting
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
