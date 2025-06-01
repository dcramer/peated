import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/sites")({
  component: Page,
});

function Page() {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "name",
    },
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const { data: siteList } = useSuspenseQuery(
    orpc.externalSites.list.queryOptions({
      input: queryParams,
    })
  );

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Sites",
            to: "/admin/sites",
            current: true,
          },
        ]}
      />
      <div className="flex items-center justify-end">
        <Button color="primary" to="/admin/sites/add">
          Add Site
        </Button>
      </div>

      {siteList.results.length > 0 ? (
        <Table
          items={siteList.results}
          rel={siteList.rel}
          url={(item) => `/admin/sites/${item.id}`}
          columns={[
            { name: "name", sort: "name", sortDefaultOrder: "asc" },
            {
              name: "type",
              sort: "type",
              sortDefaultOrder: "asc",
            },
            {
              name: "lastRunAt",
              title: "Last run",
              value: (item) =>
                item.lastRunAt ? (
                  <TimeSince date={new Date(item.lastRunAt)} />
                ) : null,
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
