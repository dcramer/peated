import { authenticator } from "@peated/web/services/auth.server";
import { type ActionFunctionArgs } from "@remix-run/node";
import { type SitemapFunction } from "remix-sitemap";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.logout(request, { redirectTo: "/login" });
}
