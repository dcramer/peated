"use client";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import BadgeTable from "@peated/web/components/admin/badgeTable";
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
      <AdminBreadcrumbs
        items={[
          {
            label: "Admin",
            href: "/admin",
          },
          {
            label: "Badges",
            href: "/admin/badges",
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        actions={
          <Button variant="default" href="/admin/badges/add">
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
