import TagForm from "@peated/web/components/admin/tagForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/tags/add")({
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const orpc = useORPC();
  const tagCreateMutation = useMutation(orpc.tags.create.mutationOptions());

  return (
    <TagForm
      onSubmit={async (data) => {
        const tag = await tagCreateMutation.mutateAsync({
          ...data,
        });
        navigate({ to: `/admin/tags/${tag.name}` });
      }}
    />
  );
}
