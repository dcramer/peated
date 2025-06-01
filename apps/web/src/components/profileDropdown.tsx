"use client";

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";
import classNames from "@peated/web/lib/classNames";
import { Fragment, useRef } from "react";
import LogoutButton from "./logoutButton";
import UserAvatar from "./userAvatar";

export function ProfileDropdown() {
  const { user } = useAuth();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  if (!user) return null;

  return (
    <Menu as="div" className="menu hidden sm:block">
      {({ open }) => (
        <>
          <MenuButton
            ref={buttonRef}
            className={classNames(
              "relative flex max-w-xs items-center p-2 text-sm hover:bg-slate-800 hover:text-white focus:outline-none",
              open
                ? "rounded-t rounded-b-none bg-slate-800 text-white"
                : "rounded text-muted"
            )}
            as={Link}
            href={`/users/${user.username}`}
          >
            <span className="sr-only">Open user menu</span>
            <div className="h-8 w-8">
              <UserAvatar user={user} />
            </div>
          </MenuButton>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <MenuItems
              ref={dropdownRef}
              static
              className="absolute right-0 z-40 mt-0 w-48 origin-top-right divide-y divide-slate-700"
            >
              <div>
                <MenuItem>
                  <Link href={`/users/${user.username}`}>Profile</Link>
                </MenuItem>
                <MenuItem>
                  <LogoutButton />
                </MenuItem>
              </div>
              {user.admin && (
                <div>
                  <MenuItem>
                    <Link href={"/admin"}>Admin</Link>
                  </MenuItem>
                </div>
              )}
            </MenuItems>
          </Transition>
        </>
      )}
    </Menu>
  );
}
