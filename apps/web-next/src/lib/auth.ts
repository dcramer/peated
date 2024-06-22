import { redirect } from "next/navigation";

export function getSafeRedirect(value: string | null) {
  if (!value || value?.indexOf("/") !== 0 || value?.indexOf("//") === 0)
    return "/";
  return value;
}

export function redirectToAuth({
  pathname = "/",
  searchParams,
}: {
  pathname?: string;
  searchParams?: URLSearchParams;
}) {
  return redirect(getAuthRedirect({ pathname, searchParams }));
}

export function getAuthRedirect({
  pathname = "/",
  searchParams,
}: {
  pathname?: string;
  searchParams?: URLSearchParams;
}) {
  const redirectTo =
    pathname + (searchParams ? `?${searchParams.toString()}` : "");

  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}
