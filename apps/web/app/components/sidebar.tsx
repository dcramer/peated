import {
  ChatBubbleLeftIcon,
  CodeBracketSquareIcon,
  GiftTopIcon,
  HomeIcon,
  InformationCircleIcon,
  StarIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import config from "@peated/web/config";
import useAuth from "@peated/web/hooks/useAuth";
import { useLocation } from "@remix-run/react";
import { Bottle as BottleIcon, Entity as EntityIcon } from "./assets";
import Button from "./button";
import FeedbackSidebarLink from "./feedbackSidebarLink";
import HeaderLogo from "./headerLogo";
import SidebarLink from "./sidebarLink";

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
                    to="/favorites"
                    icon={StarIcon}
                    active={location.pathname.startsWith("/favorites")}
                  >
                    Favorites
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
                    to="/flights"
                    icon={GiftTopIcon}
                    active={location.pathname.startsWith("/flights")}
                  >
                    Flights
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
                  <FeedbackSidebarLink />
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
