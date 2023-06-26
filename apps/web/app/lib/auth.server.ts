import { redirect } from "@remix-run/node";

export function redirectToAuth({ request }: { request: Request }) {
  const location = new URL(request.url);

  const redirectTo = location.pathname;

  return redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
}
