import SiteForm from "@peated/web/components/admin/siteForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/sites/add")({
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const orpc = useORPC();
  const siteCreateMutation = useMutation(
    orpc.externalSites.create.mutationOptions()
  );

  return (
    <SiteForm
      onSubmit={async (data) => {
        const site = await siteCreateMutation.mutateAsync(data);
        navigate({ to: `/admin/sites/${site.type}` });
      }}
    />
  );
}
