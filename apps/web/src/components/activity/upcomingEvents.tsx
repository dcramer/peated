"use client";

import DateRange from "@peated/web/components/dateRange";
import Link from "@peated/web/components/link";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export function UpcomingEventsSkeleton() {
  const Row = () => (
    <tr className="mb-8 border-b border-slate-800">
      <td className="max-w-0 space-y-1 overflow-hidden px-4 py-1 text-sm sm:px-3">
        <div className="flex animate-pulse items-center overflow-hidden bg-slate-800 -indent-96">
          Event
        </div>
        <div className="text-muted w-2/5 animate-pulse bg-slate-800 -indent-96 text-sm">
          Date
        </div>
      </td>
    </tr>
  );
  return (
    <table className="mb-4 min-w-full">
      <tbody>
        <Row />
        <Row />
        <Row />
      </tbody>
    </table>
  );
}

export default function UpcomingEvents() {
  const orpc = useORPC();
  const { data: eventList } = useSuspenseQuery(
    orpc.events.list.queryOptions({
      input: { limit: 3, onlyUpcoming: true, sort: "date" },
    })
  );

  return eventList.results.length ? (
    <table className="mb-8 min-w-full">
      <tbody>
        {eventList.results.map((event) => {
          return (
            <tr key={event.id} className="border-b border-slate-800">
              <td className="max-w-0 py-2 pl-4 pr-4 text-sm sm:pl-3">
                <div className="flex items-center space-x-1">
                  {event.website ? (
                    <Link href={event.website} className="hover:underline">
                      {event.name}
                    </Link>
                  ) : (
                    event.name
                  )}
                </div>
                <div className="text-muted flex gap-x-1 text-sm">
                  <DateRange start={event.dateStart} end={event.dateEnd} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  ) : (
    <p className="text-muted mb-8 text-center text-sm">No upcoming events.</p>
  );
}
