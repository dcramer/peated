import { toTitleCase } from "@peated/server/lib/strings";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/tags/$tagId")({
  component: Page,
});

function Page() {
  const { tagId } = Route.useParams();
  const orpc = useORPC();
  const { data: tag } = useSuspenseQuery(
    orpc.tags.details.queryOptions({
      input: {
        tag: tagId,
      },
    })
  );

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Tags",
            to: "/admin/tags",
          },
          {
            name: toTitleCase(tag.name),
            to: `/admin/tags/${tag.name}`,
            current: true,
          },
        ]}
      />

      <div className="my-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full flex-col justify-center gap-y-4 px-4 sm:w-auto sm:flex-auto sm:gap-y-2">
          <h3 className="self-center font-semibold text-4xl text-white sm:self-start">
            {toTitleCase(tag.name)}
          </h3>
          <div className="flex flex-col items-center self-center text-muted sm:flex-row sm:self-start lg:mb-8">
            {toTitleCase(tag.tagCategory)}
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center sm:w-auto sm:items-end">
          <div className="flex gap-x-2">
            <Button to="/admin/tags/$tagId/edit" params={{ tagId: tag.name }}>
              Edit Tag
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
