"use client";

import { usePathname } from "next/navigation";

import { PageTabs } from "../..";

const destinations = [
  { href: "/admin/moderation/inbox", label: "Inbox" },
  { href: "/admin/moderation/history", label: "History" },
  { href: "/admin/moderation/automation", label: "Automation" },
] as const;

export default function ModerationNav() {
  const pathname = usePathname();
  const currentHref =
    destinations.find(({ href }) => pathname.startsWith(href))?.href ??
    pathname;

  return (
    <PageTabs
      ariaLabel="Moderation"
      currentHref={currentHref}
      items={destinations}
    />
  );
}
