import { getBottleBottlingEditPath } from "@peated/web/lib/bottlings";
import { permanentRedirect } from "next/navigation";

export default async function Page(props: {
  params: Promise<{ bottleId: string; releaseId: string }>;
}) {
  const params = await props.params;

  const { bottleId, releaseId } = params;

  permanentRedirect(getBottleBottlingEditPath(bottleId, releaseId));
}
