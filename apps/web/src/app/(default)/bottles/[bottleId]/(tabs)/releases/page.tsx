import { getBottleBottlingsPath } from "@peated/web/lib/bottlings";
import { permanentRedirect } from "next/navigation";

export default function Page({
  params: { bottleId },
  searchParams,
}: {
  params: { bottleId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
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
