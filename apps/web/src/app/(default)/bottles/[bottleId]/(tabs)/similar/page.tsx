import {
  getReleaseFamilyHref,
  parseReleaseFamilyRouteId,
} from "@peated/web/lib/releaseFamily";
import { permanentRedirect } from "next/navigation";

export default async function Page(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;

  permanentRedirect(getReleaseFamilyHref(parseReleaseFamilyRouteId(bottleId)));
}
