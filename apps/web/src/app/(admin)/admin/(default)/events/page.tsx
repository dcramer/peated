"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import DateRange from "@peated/web/components/dateRange";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { trpc } from "@peated/web/lib/trpc/client";

export default function Page() {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "date",
      onlyUpcoming: false,
    },
    numericFields: ["cursor", "limit"],
  });

  const [eventList] = trpc.eventList.useSuspenseQuery(queryParams);

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Events",
            href: "/admin/events",
            current: true,
          },
        ]}
      />
      <div className="flex items-center justify-end">
        <Button color="primary" href="/admin/events/add">
          Add Event
        </Button>
      </div>

      {eventList.results.length > 0 ? (
        <Table
          items={eventList.results}
          rel={eventList.rel}
          defaultSort="date"
          url={(item) => `/admin/events/${item.id}`}
          columns={[
            { name: "name", sort: "name", sortDefaultOrder: "asc" },
            {
              name: "dateStart",
              title: "When",
              value: (v) => <DateRange start={v.dateStart} end={v.dateEnd} />,
              className: "w-64",
            },
          ]}
        />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
