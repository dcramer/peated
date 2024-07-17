"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import { trpc } from "@peated/web/lib/trpc";

export default function Page({
  params: { tagId },
}: {
  params: { tagId: string };
}) {
  const [tag] = trpc.tagByName.useSuspenseQuery(tagId);

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Tags",
            href: "/admin/tags",
          },
          {
            name: toTitleCase(tag.name),
            href: `/admin/tags/${tag.name}`,
            current: true,
          },
        ]}
      />

      <div className="my-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full flex-col justify-center gap-y-4 px-4 sm:w-auto sm:flex-auto sm:gap-y-2">
          <h3 className="self-center text-4xl font-semibold text-white sm:self-start">
            {toTitleCase(tag.name)}
          </h3>
          <div className="text-light flex flex-col items-center self-center sm:flex-row sm:self-start lg:mb-8">
            {toTitleCase(tag.tagCategory)}
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center sm:w-auto sm:items-end">
          <div className="flex gap-x-2">
            <Button href={`/admin/tags/${tag.name}/edit`}>Edit Tag</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
