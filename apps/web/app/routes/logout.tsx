import { type ActionFunctionArgs } from "@remix-run/node";
import { type SitemapFunction } from "remix-sitemap";
import { authenticator } from "~/services/auth.server";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.logout(request, { redirectTo: "/login" });
}
