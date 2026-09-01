"use client";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
  AdminSection,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminTable as Table } from "@peated/web/components/admin/adminTable.stylex";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import DateRange from "@peated/web/components/dateRange";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { getEventsNeedingNextDate } from "@peated/web/lib/eventDates";
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
  const needsNextDate = getEventsNeedingNextDate(eventList.results);

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          {
            label: "Admin",
            href: "/admin",
          },
          {
            label: "Events",
            href: "/admin/events",
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        actions={
          <Button variant="default" href="/admin/events/add">
            Add Event
          </Button>
        }
        title="Events"
      />

      {needsNextDate.length ? (
        <AdminSection
          description="The latest date has passed. Add the next confirmed edition."
          title="Needs next date"
          tone="warning"
        >
          <Table
            items={needsNextDate}
            noHeaders
            url={(item) => `/admin/events/${item.id}/next`}
            columns={[
              { name: "name" },
              {
                name: "dateStart",
                title: "Last dates",
                value: (event) => (
                  <DateRange start={event.dateStart} end={event.dateEnd} />
                ),
              },
            ]}
          />
        </AdminSection>
      ) : null}

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
