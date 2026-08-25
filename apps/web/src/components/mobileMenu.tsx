"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import useAuth from "@peated/web/hooks/useAuth";
import { getAuthRedirect } from "@peated/web/lib/auth";
import { usePathname, useSearchParams } from "next/navigation";
import { primaryNavigation } from "./appNavigation";
import Link from "./link";
import LogoutButton from "./logoutButton";

export default function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const libraryHref = user ? `/users/${user.username}/library` : "/library";

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50 lg:hidden">
      <DialogBackdrop className="fixed inset-0 bg-slate-950" />
      <div className="fixed inset-0">
        <DialogPanel className="flex h-full w-full flex-col overflow-y-auto bg-slate-950 px-5 pb-7 pt-4">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="Peated home" onClick={onClose}>
              <PeatedGlyph className="text-muted h-8 w-auto" />
            </Link>
            <button
              type="button"
              aria-label="Close menu"
              onClick={onClose}
              className="text-muted focus-visible:outline-highlight flex h-11 w-11 items-center justify-center rounded hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <DialogTitle className="sr-only">Peated menu</DialogTitle>

          <nav aria-label="Mobile navigation" className="mt-7">
            <ul className="space-y-1">
              {primaryNavigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="hover:text-highlight focus-visible:outline-highlight block rounded px-2 py-2 text-base font-semibold text-white focus-visible:outline focus-visible:outline-2"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-6 border-t border-slate-700 pt-5">
            <Link
              href="/addBottle?intent=tasting"
              onClick={onClose}
              className="text-highlight font-semibold hover:text-white"
            >
              + Add tasting
            </Link>
          </div>

          <nav aria-label="Account navigation" className="mt-7">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <li>
                <Link
                  href={libraryHref}
                  onClick={onClose}
                  className="text-muted hover:text-white"
                >
                  Library
                </Link>
              </li>
              <li>
                <Link
                  href="/friends"
                  onClick={onClose}
                  className="text-muted hover:text-white"
                >
                  Friends
                </Link>
              </li>
              <li>
                <Link
                  href="/flights"
                  onClick={onClose}
                  className="text-muted hover:text-white"
                >
                  Flights
                </Link>
              </li>
              <li>
                <Link
                  href="/locations"
                  onClick={onClose}
                  className="text-muted hover:text-white"
                >
                  Locations
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  onClick={onClose}
                  className="text-muted hover:text-white"
                >
                  About
                </Link>
              </li>
              {user ? (
                <>
                  <li>
                    <Link
                      href={`/users/${user.username}`}
                      onClick={onClose}
                      className="text-muted hover:text-white"
                    >
                      Profile
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/notifications"
                      onClick={onClose}
                      className="text-muted hover:text-white"
                    >
                      Notifications
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/settings"
                      onClick={onClose}
                      className="text-muted hover:text-white"
                    >
                      Settings
                    </Link>
                  </li>
                  <li className="text-muted hover:text-white [&_button]:text-left">
                    <LogoutButton />
                  </li>
                </>
              ) : (
                <li>
                  <Link
                    href={getAuthRedirect({ pathname, searchParams })}
                    onClick={onClose}
                    className="text-highlight hover:text-white"
                  >
                    Sign in
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
