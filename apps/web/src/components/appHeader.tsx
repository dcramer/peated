"use client";

import {
  Bars3Icon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import useAuth from "@peated/web/hooks/useAuth";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getAuthRedirect } from "../lib/auth";
import { primaryNavigation } from "./appNavigation";
import HeaderLogo from "./headerLogo";
import Link from "./link";
import MobileMenu from "./mobileMenu";
import { Modal } from "./modal";
import NavLink from "./navLink";
import NotificationsPanel from "./notifications/panel";
import { ProfileDropdown } from "./profileDropdown";
import { SearchPanel } from "./search";

export default function AppHeader({
  showNavigation = true,
}: {
  showNavigation?: boolean;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [searchPath, setSearchPath] = useState<string | null>(null);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const searchOpen = searchPath === pathname;
  const menuOpen = menuPath === pathname;

  return (
    <div className="flex w-full items-center gap-x-3">
      {showNavigation ? (
        <>
          <div className="shrink-0">
            <HeaderLogo />
          </div>

          <nav
            aria-label="Primary navigation"
            className="ml-6 hidden shrink-0 items-center gap-x-1 lg:flex"
          >
            {primaryNavigation.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                selected={
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`)
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </>
      ) : null}

      <div className="ml-auto flex items-center gap-x-1">
        <button
          type="button"
          aria-label="Search Peated"
          onClick={() => setSearchPath(pathname)}
          className="text-muted focus-visible:outline-highlight flex h-10 items-center gap-x-2 rounded px-2 text-sm font-medium hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2"
        >
          <MagnifyingGlassIcon className="h-5 w-5" />
          <span className="hidden xl:inline">Search</span>
        </button>

        {showNavigation ? (
          <Link
            href="/addBottle?intent=tasting"
            className="text-highlight focus-visible:outline-highlight hidden h-10 items-center gap-x-1.5 rounded px-2 text-sm font-semibold hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 lg:flex"
          >
            <PlusIcon className="h-4 w-4" />
            Add tasting
          </Link>
        ) : null}
      </div>

      {user ? (
        <div className="hidden items-center gap-x-1 lg:flex">
          <NotificationsPanel />
          <ProfileDropdown />
        </div>
      ) : (
        <Link
          href={getAuthRedirect({ pathname, searchParams })}
          className="text-muted hidden shrink-0 px-2 text-sm font-semibold hover:text-white lg:block"
        >
          Sign in
        </Link>
      )}

      {showNavigation ? (
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMenuPath(pathname)}
          className="text-muted focus-visible:outline-highlight flex h-10 w-10 shrink-0 items-center justify-center rounded hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 lg:hidden"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
      ) : null}

      <Modal open={searchOpen} onClose={() => setSearchPath(null)}>
        <SearchPanel
          value={query}
          onQueryChange={setQuery}
          onClose={() => setSearchPath(null)}
        />
      </Modal>

      {showNavigation ? (
        <MobileMenu open={menuOpen} onClose={() => setMenuPath(null)} />
      ) : null}
    </div>
  );
}
