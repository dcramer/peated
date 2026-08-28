"use client";

import {
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import BadgeTable from "@peated/web/components/admin/badgeTable";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "name",
    },
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const { data: badgeList } = useSuspenseQuery(
    orpc.badges.list.queryOptions({
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
            name: "Badges",
            href: "/admin/badges",
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        actions={
          <Button color="primary" href="/admin/badges/add">
            Add Badge
          </Button>
        }
        title="Badges"
      />
      {badgeList.results.length > 0 ? (
        <BadgeTable badgeList={badgeList.results} rel={badgeList.rel} />
      ) : (
        <EmptyActivity>No badges yet.</EmptyActivity>
      )}
    </AdminPage>
  );
}
