import TagForm from "@peated/web/components/admin/tagForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/tags/$tagId/edit")({
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
    }),
  );

  const navigate = useNavigate();
  const tagUpdateMutation = useMutation(orpc.tags.update.mutationOptions());

  return (
    <TagForm
      onSubmit={async (data) => {
        const newTag = await tagUpdateMutation.mutateAsync({
          ...data,
          tag: tag.name,
        });
        navigate({ to: `/admin/tags/${newTag.name}` });
      }}
      edit
      title="Edit Tag"
      initialData={tag}
    />
  );
}
