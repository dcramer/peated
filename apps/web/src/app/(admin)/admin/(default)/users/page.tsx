"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { trpc } from "@peated/web/lib/trpc/client";

export default function Page() {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "-created",
    },
  });

  const [userList] = trpc.userList.useSuspenseQuery(queryParams);

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
