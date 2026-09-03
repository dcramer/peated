import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { redirect } from "next/navigation";

function getFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AddTasting(props: {
  params: Promise<{ bottleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ bottleId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  redirect(
    getAddBottleHref({
      bottleId: parseCatalogRouteId(bottleId),
      flightId: getFirst(searchParams.flight),
      intent: "tasting",
    }),
  );
}
