"use client";

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
    <div>
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
      <div className="flex items-center justify-end">
        <Button color="primary" href="/admin/tags/add">
          Add Tag
        </Button>
      </div>
      {tagList.results.length > 0 ? (
        <TagTable tagList={tagList.results} rel={tagList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
