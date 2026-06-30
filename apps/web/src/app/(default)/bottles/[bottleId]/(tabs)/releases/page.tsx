import { getBottleBottlingsPath } from "@peated/web/lib/bottlings";
import { permanentRedirect } from "next/navigation";

export default async function Page(props: {
  params: Promise<{ bottleId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const { bottleId } = params;

  const nextParams = new URLSearchParams();
  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => nextParams.append(key, item));
    } else if (value !== undefined) {
      nextParams.set(key, value);
    }
  });

  permanentRedirect(
    `${getBottleBottlingsPath(bottleId)}${nextParams.size ? `?${nextParams.toString()}` : ""}`,
  );
}
