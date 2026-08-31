"use client";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import TagTable from "@peated/web/components/admin/tagTable";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const { data: tagList } = useSuspenseQuery(
    orpc.tags.list.queryOptions({
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
            label: "Tags",
            href: "/admin/tags",
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        actions={
          <Button variant="default" href="/admin/tags/add">
            Add Tag
          </Button>
        }
        title="Tags"
      />
      {tagList.results.length > 0 ? (
        <TagTable tagList={tagList.results} rel={tagList.rel} />
      ) : (
        <EmptyActivity>No tags yet.</EmptyActivity>
      )}
    </AdminPage>
  );
}
