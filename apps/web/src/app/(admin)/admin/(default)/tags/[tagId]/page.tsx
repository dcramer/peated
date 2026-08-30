"use client";

import { use } from "react";

import { toTitleCase } from "@peated/server/lib/strings";
import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page({
  params,
}: {
  params: Promise<{ tagId: string }>;
}) {
  const { tagId } = use(params);
  const orpc = useORPC();
  const { data: tag } = useSuspenseQuery(
    orpc.tags.details.queryOptions({ input: { tag: tagId } }),
  );
  const name = toTitleCase(tag.name);

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "Tags", href: "/admin/tags" },
          { label: name, href: `/admin/tags/${tag.name}`, current: true },
        ]}
      />
      <AdminPageHeader
        title={name}
        description={toTitleCase(tag.tagCategory)}
        actions={
          <Button href={`/admin/tags/${tag.name}/edit`}>Edit tag</Button>
        }
      />
    </AdminPage>
  );
}
