import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getReleaseFamilyHref } from "@peated/web/lib/releaseFamily";
import { permanentRedirect } from "next/navigation";

export default async function SimilarBottlePage(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const bottle = await getBottlePage(parseCatalogRouteId(bottleId));
  permanentRedirect(getReleaseFamilyHref(bottle));
}
