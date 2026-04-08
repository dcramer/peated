import { getNewBottleBottlingPath } from "@peated/web/lib/bottlings";
import { permanentRedirect } from "next/navigation";

export default function AddRelease({
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
    `${getNewBottleBottlingPath(bottleId)}${nextParams.size ? `?${nextParams.toString()}` : ""}`,
  );
}
