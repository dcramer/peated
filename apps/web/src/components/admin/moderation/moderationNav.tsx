"use client";

import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import { usePathname } from "next/navigation";

const destinations = [
  { href: "/admin/moderation/inbox", label: "Inbox" },
  { href: "/admin/moderation/history", label: "History" },
  { href: "/admin/moderation/automation", label: "Automation" },
];

export default function ModerationNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Moderation"
      className="border-b border-slate-800 bg-slate-950 lg:hidden"
    >
      <div className="flex gap-1 overflow-x-auto p-3 lg:block lg:space-y-1 lg:p-5">
        <div className="hidden pb-4 lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Moderation
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Decisions, outcomes, and recovery.
          </p>
        </div>
        {destinations.map((destination) => {
          const active = pathname.startsWith(destination.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={classNames(
                "inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold lg:flex",
                active
                  ? "bg-highlight text-slate-950"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white",
              )}
              href={destination.href}
              key={destination.href}
            >
              {destination.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
