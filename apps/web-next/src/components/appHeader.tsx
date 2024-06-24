"use client";

import { Dialog } from "@headlessui/react";
import { useEffect, useState } from "react";

import useAuth from "@peated/web/hooks/useAuth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getAuthRedirect } from "../lib/auth";
import NavLink from "./navLink";
import NotificationsPanel from "./notifications/panel";
import { ProfileDropdown } from "./profileDropdown";
import { SearchPanel } from "./search";
import UserAvatar from "./userAvatar";

export default function AppHeader() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    setSearchOpen(false);
  }, [pathname]);

  return (
    <div className="flex flex-auto items-center gap-x-2 sm:gap-x-4">
      <form
        className="flex-auto"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(query)}`);
        }}
      >
        <input
          name="q"
          placeholder="Search for bottles, brands, and people"
          autoComplete="off"
          className="w-full transform rounded border-0 border-transparent bg-slate-800 px-2 py-1.5 text-white placeholder:text-slate-400 focus:border-transparent focus:outline focus:outline-slate-700 focus:ring-0 sm:px-3 sm:py-2"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!searchOpen) setSearchOpen(true);
          }}
          onFocus={() => {
            // not sure a better way to work around default focus
            if (!searchFocused) {
              setSearchFocused(true);
              setSearchOpen(true);
            }
          }}
        />
        <Dialog
          open={searchOpen}
          as="div"
          className="dialog"
          onClose={setSearchOpen}
        >
          <Dialog.Overlay className="fixed inset-0" />
          <Dialog.Panel className="dialog-panel">
            <SearchPanel
              onQueryChange={(value) => setQuery(value)}
              onClose={() => {
                setSearchOpen(false);
                setTimeout(() => setSearchFocused(false), 100);
              }}
            />
          </Dialog.Panel>
        </Dialog>
      </form>
      {user ? (
        <div className="flex items-center gap-x-2">
          <div className="hidden sm:block">
            <NotificationsPanel />
          </div>
          <div className="block sm:hidden">
            <NavLink href={`/users/${user.username}`}>
              <div className="h-8 w-8 sm:h-8 sm:w-8">
                <UserAvatar user={user} />
              </div>
            </NavLink>
          </div>
          <ProfileDropdown />
        </div>
      ) : (
        <div className="mflex items-center gap-x-2">
          <NavLink
            href={`/login?redirectTo=${getAuthRedirect({
              pathname,
              searchParams,
            })}`}
          >
            <div className="h-8 w-8 sm:h-8 sm:w-8">
              <UserAvatar />
            </div>
          </NavLink>
        </div>
      )}
    </div>
  );
}
