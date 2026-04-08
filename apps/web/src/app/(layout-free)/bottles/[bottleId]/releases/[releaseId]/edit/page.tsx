import { getBottleBottlingEditPath } from "@peated/web/lib/bottlings";
import { permanentRedirect } from "next/navigation";

export default function Page({
  params: { bottleId, releaseId },
}: {
  params: { bottleId: string; releaseId: string };
}) {
  permanentRedirect(getBottleBottlingEditPath(bottleId, releaseId));
}
