"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import { trpc } from "@peated/web/lib/trpc";
import { useSearchParams } from "next/navigation";

export const fetchCache = "default-no-store";

export const dynamic = "force-dynamic";

export default function Page() {
  const searchParams = useSearchParams();
  const numericFields = new Set(["cursor", "limit"]);
  const [userList] = trpc.userList.useSuspenseQuery({
    sort: "-created",
    ...Object.fromEntries(
      [...searchParams.entries()].map(([k, v]) =>
        numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
      ),
    ),
  });

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
