import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { notFound, redirect } from "next/navigation";

function getFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    notFound();
  }
  return id;
}

export default async function AddTasting(props: {
  params: Promise<{ bottleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ bottleId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const legacyReleaseId =
    getFirst(searchParams.release) ?? getFirst(searchParams.bottling);
  const directBottleId = legacyReleaseId
    ? (
        await resolveOrNotFound(
          (await getAnonymousServerClient()).client.bottleReleases.bottle({
            bottle: parseId(bottleId),
            release: parseId(legacyReleaseId),
          }),
        )
      ).bottleId
    : parseId(bottleId);

  redirect(
    getAddBottleHref({
      bottleId: directBottleId,
      flightId: getFirst(searchParams.flight),
      intent: "tasting",
    }),
  );
}
