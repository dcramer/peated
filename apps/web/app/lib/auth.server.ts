import { redirect } from "@remix-run/node";
import { getAuthRedirect } from "./auth";

export function redirectToAuth({ request }: { request: Request }) {
  return redirect(getAuthRedirect({ request }));
}
