import { redirect } from "next/navigation";

const AUTH_PATHS = [
  "/login",
  "/register",
  "/verify",
  "/auth/tos-required",
  "/auth/magic-link",
  "/recover-account",
  "/password-reset",
  "/logout",
];

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
  const isAuthPath = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const finalPathname = isAuthPath ? "/" : pathname;
  const redirectTo =
    finalPathname + (searchParams ? `?${searchParams.toString()}` : "");

  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}
