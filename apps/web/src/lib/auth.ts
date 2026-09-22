import { redirect } from "next/navigation";

const AUTH_PATHS = [
  "/login",
  "/register",
  "/verify",
  "/auth/tos-required",
  "/auth/suspended",
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

/**
 * Where a member goes after the API reports an account-state change, or null
 * when the refreshed session is still usable. Suspended members go to the
 * suspension screen; anyone without a working session goes to sign in.
 */
export function getAccountStateRedirect(
  session: {
    accessToken?: string | null;
    user: { suspendedAt?: string } | null;
  },
  location: { pathname?: string; searchParams?: URLSearchParams },
): string | null {
  if (session.user?.suspendedAt) return "/auth/suspended";
  if (session.user && session.accessToken) return null;
  return getAuthRedirect(location);
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
