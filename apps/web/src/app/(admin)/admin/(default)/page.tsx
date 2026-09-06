"use client";

import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import ScraperActivity from "@peated/web/components/admin/scraperActivity";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(orpc.admin.scraperActivity.queryOptions());

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[{ label: "Overview", href: "/admin", current: true }]}
      />
      <AdminPageHeader title="Admin" />
      <ScraperActivity data={data} />
    </AdminPage>
  );
}
