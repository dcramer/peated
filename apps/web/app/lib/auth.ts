import { redirect } from "@remix-run/node";

export function redirectToAuth({ request }: { request: Request }) {
  return redirect(getAuthRedirect({ request }));
}

export function getAuthRedirect({ request }: { request: Request }) {
  const location = new URL(request.url);

  const redirectTo = location.pathname;

  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}
