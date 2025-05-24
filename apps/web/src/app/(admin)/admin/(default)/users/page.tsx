"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "-created",
    },
  });

  const orpc = useORPC();
  const { data: userList } = useSuspenseQuery(
    orpc.users.list.queryOptions({
      input: {
        ...queryParams,
      },
    }),
  );

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Users",
            href: "/admin/users",
            current: true,
          },
        ]}
      />

      <Table
        items={userList.results}
        rel={userList.rel}
        defaultSort="-created"
        url={(item) => `/users/${item.username}`}
        columns={[
          { name: "username", sort: "name", sortDefaultOrder: "asc" },
          {
            name: "createdAt",
            title: "Created",
            sort: "created",
            value: (v) => !!v.createdAt && <TimeSince date={v.createdAt} />,
          },
        ]}
      />
    </div>
  );
}
