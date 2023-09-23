import {
  ChatBubbleLeftIcon,
  CodeBracketSquareIcon,
  Cog6ToothIcon,
  HomeIcon,
  InboxIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  StarIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { Link, useLocation } from "@remix-run/react";
import { Fragment } from "react";
import config from "~/config";
import useAuth from "~/hooks/useAuth";
import { Bottle as BottleIcon, Entity as EntityIcon } from "./assets";
import Button from "./button";
import HeaderLogo from "./headerLogo";
import { NotificationCount } from "./notificationCount";
import QueryBoundary from "./queryBoundary";
import SidebarLink from "./sidebarLink";
import UserAvatar from "./userAvatar";

export default function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const queryString = new URLSearchParams(location.search);

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-10 lg:flex lg:w-64 lg:flex-col">
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
                    to="/favorites"
                    icon={StarIcon}
                    active={location.pathname.startsWith("/favorites")}
                  >
                    Favorites
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
                  <SidebarLink
                    to="/friends"
                    icon={UserGroupIcon}
                    active={location.pathname.startsWith("/friends")}
                  >
                    Friends
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
                    to={{
                      pathname: "/entities",
                      search: "?type=distiller",
                    }}
                    icon={EntityIcon}
                    active={
                      location.pathname === "/entities" &&
                      queryString.get("type") === "distiller"
                    }
                  >
                    Distillers
                  </SidebarLink>
                  <SidebarLink
                    to={{
                      pathname: "/entities",
                      search: "?type=brand",
                    }}
                    icon={EntityIcon}
                    active={
                      location.pathname === "/entities" &&
                      queryString.get("type") === "brand"
                    }
                  >
                    Brands
                  </SidebarLink>
                  <SidebarLink
                    to={{
                      pathname: "/entities",
                      search: "?type=bottler",
                    }}
                    icon={EntityIcon}
                    active={
                      location.pathname === "/entities" &&
                      queryString.get("type") === "bottler"
                    }
                  >
                    Bottlers
                  </SidebarLink>
                </ul>
              </li>
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  <SidebarLink
                    to={config.GITHUB_REPO}
                    icon={CodeBracketSquareIcon}
                  >
                    GitHub
                  </SidebarLink>
                  <SidebarLink
                    to={config.DISCORD_LINK}
                    icon={ChatBubbleLeftIcon}
                  >
                    Discord
                  </SidebarLink>
                  <SidebarLink
                    to="/about"
                    icon={InformationCircleIcon}
                    active={location.pathname.startsWith("/about")}
                  >
                    About
                  </SidebarLink>
                </ul>
              </li>
              {user?.admin && (
                <li>
                  <div className="text-xs font-semibold leading-6 text-slate-700">
                    Admin
                  </div>
                  <ul role="list" className="-mx-2 space-y-1">
                    <SidebarLink
                      to="/admin/stores"
                      icon={Cog6ToothIcon}
                      active={location.pathname.startsWith("/admin/stores")}
                    >
                      Stores
                    </SidebarLink>
                    <SidebarLink
                      to="/admin/badges"
                      icon={Cog6ToothIcon}
                      active={location.pathname.startsWith("/admin/badges")}
                    >
                      Badges
                    </SidebarLink>
                  </ul>
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
