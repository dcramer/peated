import { redirect } from "next/navigation";

import AddBottleFlow from "./addBottleFlow";

const legacyCreateFormParams = new Set([
  "name",
  "distiller",
  "brand",
  "bottler",
  "series",
  "proposal",
  "returnTo",
  "returnAction",
]);

function hasLegacyCreateFormParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  return Object.keys(searchParams).some((key) =>
    legacyCreateFormParams.has(key),
  );
}

export default async function AddBottle(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;

  if (!hasLegacyCreateFormParams(searchParams)) {
    return <AddBottleFlow />;
  }

  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value != null) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  redirect(`/bottles/new${queryString ? `?${queryString}` : ""}`);
}
