import {
  AdminLayout,
  type AdminNavigationGroup,
} from "@peated/web/components/admin/adminLayout.stylex";
import { getSession } from "@peated/web/lib/session.server";
import React from "react";

// Groups moderators can use. Everything else needs an administrator.
const MODERATOR_GROUPS = new Set(["Moderation", "Content"]);

const navigationGroups = [
  {
    label: "Operations",
    items: [
      { href: "/admin", label: "Overview", match: "exact" },
      {
        href: "/admin/moderation/automation",
        label: "Background work",
      },
      { href: "/admin/sites", label: "Scrapers" },
      { href: "/admin/maintenance", label: "Maintenance" },
    ],
  },
  {
    label: "Moderation",
    items: [
      { href: "/admin/moderation/inbox", label: "Inbox" },
      { href: "/admin/moderation/history", label: "History" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/reviews", label: "Reviews" },
      { href: "/admin/tastings", label: "Tastings" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/badges", label: "Badges" },
      { href: "/admin/events", label: "Events" },
      { href: "/admin/locations", label: "Locations" },
      { href: "/admin/tags", label: "Tags" },
    ],
  },
  {
    label: "Access",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/oauth-clients", label: "OAuth clients" },
    ],
  },
] satisfies readonly AdminNavigationGroup[];

export default async function AdminRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const groups = session.user?.admin
    ? navigationGroups
    : navigationGroups.filter(({ label }) => MODERATOR_GROUPS.has(label));
  return <AdminLayout groups={groups}>{children}</AdminLayout>;
}
