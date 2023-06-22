import type { ActionArgs } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";

export async function action({ request }: ActionArgs) {
  await authenticator.logout(request, { redirectTo: "/login" });
}
