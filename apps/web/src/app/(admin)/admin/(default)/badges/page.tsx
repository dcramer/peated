"use client";

import BadgeTable from "@peated/web/components/admin/badgeTable";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { trpc } from "@peated/web/lib/trpc/client";
import { useSearchParams } from "next/navigation";

export default function Page() {
  const searchParams = useSearchParams();
  const [badgeList] = trpc.badgeList.useSuspenseQuery({
    sort: "name",
    ...Object.fromEntries(searchParams.entries()),
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
            name: "Badges",
            href: "/admin/badges",
            current: true,
          },
        ]}
      />
      <div className="flex items-center justify-end">
        <Button color="primary" href="/admin/badges/add">
          Add Badge
        </Button>
      </div>
      {badgeList.results.length > 0 ? (
        <BadgeTable badgeList={badgeList.results} rel={badgeList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
