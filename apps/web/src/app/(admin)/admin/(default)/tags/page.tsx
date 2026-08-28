"use client";

import {
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import TagTable from "@peated/web/components/admin/tagTable";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
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
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Tags",
            href: "/admin/tags",
            current: true,
          },
        ]}
      />
      <AdminPageHeader
        actions={
          <Button color="primary" href="/admin/tags/add">
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
