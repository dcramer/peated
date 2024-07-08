"use client";

import Button from "@peated/web/components/button";
import HeaderLogo from "@peated/web/components/headerLogo";
import SidebarLink from "@peated/web/components/sidebarLink";
import { usePathname } from "next/navigation";

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-slate-800 bg-slate-950 px-6 pb-4">
          <div className="text-highlight flex h-16 shrink-0 items-center hover:text-white">
            <HeaderLogo />
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <Button href="/" fullWidth color="primary">
                  Return Home
                </Button>
              </li>
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  <SidebarLink
                    href="/admin/sites"
                    active={pathname.startsWith("/admin/sites")}
                  >
                    Sites
                  </SidebarLink>
                  <SidebarLink
                    href="/admin/badges"
                    active={pathname.startsWith("/admin/badges")}
                  >
                    Badges
                  </SidebarLink>
                  <SidebarLink
                    href="/admin/locations"
                    active={pathname.startsWith("/admin/locations")}
                  >
                    Locations
                  </SidebarLink>
                  <SidebarLink
                    href="/admin/tags"
                    active={pathname.startsWith("/admin/tags")}
                  >
                    Tags
                  </SidebarLink>
                  <SidebarLink
                    href="/admin/users"
                    active={pathname.startsWith("/admin/users")}
                  >
                    Users
                  </SidebarLink>
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
