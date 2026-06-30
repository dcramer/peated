import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
export { default } from "@peated/web/components/defaultLayout";

export async function generateMetadata(props: {
  params: Promise<{ badgeId: string }>;
}) {
  const params = await props.params;

  const { badgeId } = params;

  const { client } = await getServerClient();
  const badge = await resolveOrNotFound(
    client.badges.details({
      badge: parseInt(badgeId, 10),
    }),
  );

  return {
    title: `${badge.name} - Badge Details`,
  };
}
