"use client";

import {
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import DateRange from "@peated/web/components/dateRange";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "date",
      onlyUpcoming: false,
    },
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const { data: eventList } = useSuspenseQuery(
    orpc.events.list.queryOptions({
      input: queryParams,
    }),
  );

  return (
    <AdminPage>
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
      <AdminPageHeader
        actions={
          <Button color="primary" href="/admin/events/add">
            Add Event
          </Button>
        }
        title="Events"
      />

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
            },
          ]}
        />
      ) : (
        <EmptyActivity>No events yet.</EmptyActivity>
      )}
    </AdminPage>
  );
}
