"use client";

import TagTable from "@peated/web/components/admin/tagTable";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { trpc } from "@peated/web/lib/trpc";
import { useSearchParams } from "next/navigation";

export const fetchCache = "default-no-store";

export const dynamic = "force-dynamic";

export default function Page() {
  const searchParams = useSearchParams();
  const [tagList] = trpc.tagList.useSuspenseQuery({
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
