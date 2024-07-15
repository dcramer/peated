"use client";

import { useEffect, useState } from "react";

import useAuth from "@peated/web/hooks/useAuth";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getAuthRedirect } from "../lib/auth";
import { Modal } from "./modal";
import NavLink from "./navLink";
import NotificationsPanel from "./notifications/panel";
import { ProfileDropdown } from "./profileDropdown";
import { SearchPanel } from "./search";
import SearchHeaderForm from "./searchHeaderForm";
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
      <SearchHeaderForm
        placeholder="Search for bottles, brands, and people"
        value={query}
        onSubmit={(value) => {
          router.push(`/search?q=${encodeURIComponent(value)}`);
        }}
        onChange={(value) => {
          setQuery(value);
          if (!searchOpen) setSearchOpen(true);
        }}
        onFocus={() => {
          // not sure a better way to work around default focus
          if (!searchFocused) {
            setSearchFocused(true);
            setSearchOpen(true);
          }
        }}
      >
        <Modal open={searchOpen} onClose={setSearchOpen}>
          <SearchPanel
            value={query}
            onQueryChange={(value) => setQuery(value)}
            onClose={() => {
              setSearchOpen(false);
              setTimeout(() => setSearchFocused(false), 100);
            }}
          />
        </Modal>
      </SearchHeaderForm>
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
            href={getAuthRedirect({
              pathname,
              searchParams,
            })}
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
