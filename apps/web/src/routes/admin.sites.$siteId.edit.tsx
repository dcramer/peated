import SiteForm from "@peated/web/components/admin/siteForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/sites/$siteId/edit")({
  component: Page,
});

function Page() {
  const { siteId } = Route.useParams();
  const orpc = useORPC();
  const { data: site } = useSuspenseQuery(
    orpc.externalSites.details.queryOptions({
      input: {
        site: siteId as any,
      },
    })
  );

  const navigate = useNavigate();
  const siteUpdateMutation = useMutation(
    orpc.externalSites.update.mutationOptions()
  );

  return (
    <SiteForm
      onSubmit={async (data) => {
        const newSite = await siteUpdateMutation.mutateAsync({
          ...data,
          site: site.type,
        });
        navigate({ to: `/admin/sites/${newSite.type}` });
      }}
      edit
      title="Edit Site"
      initialData={site}
    />
  );
}
