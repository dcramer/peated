import { getAddBottleHref } from "@peated/web/lib/addBottle";
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
  redirect(
    getAddBottleHref({
      bottleId: parseId(bottleId),
      flightId: getFirst(searchParams.flight),
      intent: "tasting",
    }),
  );
}
