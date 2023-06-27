import {
  Cog6ToothIcon,
  HomeIcon,
  InboxIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { Link } from "@remix-run/react";
import type { ElementType, PropsWithChildren } from "react";
import { Fragment } from "react";
import { useLocation } from "react-router-dom";
import useAuth from "~/hooks/useAuth";
import classNames from "~/lib/classNames";
import { Bottle as BottleIcon, Entity as EntityIcon } from "./assets";
import Button from "./button";
import HeaderLogo from "./headerLogo";
import { NotificationCount } from "./notifications/count";
import QueryBoundary from "./queryBoundary";
import UserAvatar from "./userAvatar";

function SidebarLink({
  to,
  active = false,
  icon,
  children,
}: PropsWithChildren<{
  to: string;
  active?: boolean;
  icon?: ElementType;
}>) {
  const Icon = icon;
  return (
    <li>
      <Link
        to={to}
        className={classNames(
          active
            ? "text-highlight border-highlight"
            : "border-transparent text-slate-500 hover:border-slate-400 hover:text-slate-400",
          "border-l-4",
          "group flex gap-x-3 p-2 text-sm font-semibold leading-6",
        )}
      >
        {Icon && (
          <Icon
            className={classNames(
              active
                ? "text-highlight"
                : "text-slate-500 group-hover:text-slate-400",
              "h-6 w-6 shrink-0",
            )}
            aria-hidden="true"
          />
        )}
        {children}
      </Link>
    </li>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const navigation = [
    {
      name: "Activity",
      href: "/",
      icon: HomeIcon,
      current: location.pathname === "/",
    },
    {
      name: "Search",
      href: "/search",
      icon: MagnifyingGlassIcon,
      current: location.pathname.startsWith("/search"),
    },
    {
      name: "Notifications",
      href: "/notifications",
      icon: InboxIcon,
      current: location.pathname.startsWith("/notifications"),
      extra: () => (
        <QueryBoundary fallback={() => null} loading={<Fragment />}>
          <NotificationCount />
        </QueryBoundary>
      ),
    },
    {
      name: "Bottles",
      href: "/bottles",
      icon: BottleIcon,
      current: location.pathname.startsWith("/bottles"),
    },
    {
      name: "Brands & Distillers",
      href: "/entities",
      icon: EntityIcon,
      current: location.pathname.startsWith("/entities"),
    },
  ];

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
                <Button to="/search?tasting" fullWidth color="highlight">
                  Record Tasting
                </Button>
              </li>
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  <SidebarLink
                    to="/"
                    icon={HomeIcon}
                    active={location.pathname === "/"}
                  >
                    Activity
                  </SidebarLink>
                  <SidebarLink
                    to="/search"
                    icon={MagnifyingGlassIcon}
                    active={location.pathname.startsWith("/search")}
                  >
                    Search
                  </SidebarLink>
                  <SidebarLink
                    to="/notifications"
                    icon={InboxIcon}
                    active={location.pathname.startsWith("/notifications")}
                  >
                    Notifications
                    <QueryBoundary fallback={() => null} loading={<Fragment />}>
                      <NotificationCount />
                    </QueryBoundary>
                  </SidebarLink>
                </ul>
              </li>
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  <SidebarLink
                    to="/bottles"
                    icon={BottleIcon}
                    active={location.pathname.startsWith("/bottles")}
                  >
                    Bottles
                  </SidebarLink>
                  <SidebarLink
                    to="/distillers"
                    icon={EntityIcon}
                    active={location.pathname.startsWith("/distillers")}
                  >
                    Distillers
                  </SidebarLink>
                  <SidebarLink
                    to="/brands"
                    icon={EntityIcon}
                    active={location.pathname.startsWith("/brands")}
                  >
                    Brands
                  </SidebarLink>
                  <SidebarLink
                    to="/bottlers"
                    icon={EntityIcon}
                    active={location.pathname.startsWith("/bottlers")}
                  >
                    Bottlers
                  </SidebarLink>
                </ul>
              </li>
              {user?.admin && (
                <li>
                  <div className="text-xs font-semibold leading-6 text-slate-700">
                    Admin
                  </div>
                  <Link
                    to="/admin/stores"
                    className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                  >
                    <Cog6ToothIcon
                      className="h-6 w-6 shrink-0 text-slate-500 group-hover:text-slate-300"
                      aria-hidden="true"
                    />
                    Stores
                  </Link>
                </li>
              )}
              <li className="-mx-6 mt-auto">
                {user ? (
                  <Link
                    to={`/users/${user.username}`}
                    className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                  >
                    <UserAvatar size={32} user={user} />
                    <span className="sr-only">Your profile</span>
                    <span aria-hidden="true">{user.username}</span>
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                  >
                    <UserAvatar size={32} />
                    Log in
                  </Link>
                )}
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
