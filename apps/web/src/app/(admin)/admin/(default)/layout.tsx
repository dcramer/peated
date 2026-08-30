import {
  AdminWorkspace,
  type AdminNavigationGroup,
} from "@peated/web/components/designSystem/product/adminWorkspace.stylex";
import React from "react";

const navigationGroups = [
  {
    label: "Moderation",
    items: [
      { href: "/admin/moderation/inbox", label: "Inbox" },
      { href: "/admin/moderation/history", label: "History" },
      { href: "/admin/moderation/automation", label: "Automation" },
    ],
  },
  {
    label: "Admin tools",
    items: [
      { href: "/admin/badges", label: "Badges" },
      { href: "/admin/events", label: "Events" },
      { href: "/admin/locations", label: "Locations" },
      { href: "/admin/oauth-clients", label: "OAuth clients" },
      { href: "/admin/sites", label: "Scrapers" },
      { href: "/admin/tags", label: "Tags" },
      { href: "/admin/users", label: "Users" },
    ],
  },
] satisfies readonly AdminNavigationGroup[];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminWorkspace groups={navigationGroups}>{children}</AdminWorkspace>;
}
