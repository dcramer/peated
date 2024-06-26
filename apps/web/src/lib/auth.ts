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
  const finalPathname = pathname.indexOf("/login") === 0 ? "/" : pathname;
  const redirectTo =
    finalPathname + (searchParams ? `?${searchParams.toString()}` : "");

  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}
