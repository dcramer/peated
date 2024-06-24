"use client";

import {
  ChatBubbleLeftIcon,
  CodeBracketSquareIcon,
  GiftTopIcon,
  HomeIcon,
  InformationCircleIcon,
  StarIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import BottleIcon from "@peated/web/assets/bottle.svg";
import BottlerIcon from "@peated/web/assets/bottler.svg";
import BrandIcon from "@peated/web/assets/brand.svg";
import DistillerIcon from "@peated/web/assets/distiller.svg";
import config from "@peated/web/config";
import { usePathname } from "next/navigation";
import Button from "./button";
import FeedbackSidebarLink from "./feedbackSidebarLink";
import HeaderLogo from "./headerLogo";
import SidebarLink from "./sidebarLink";

export default function Sidebar() {
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
                <Button href="/search?tasting" fullWidth color="highlight">
                  Record Tasting
                </Button>
              </li>
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  <SidebarLink
                    href="/"
                    icon={HomeIcon}
                    active={
                      pathname === "/" || pathname.startsWith("/activity/")
                    }
                  >
                    Activity
                  </SidebarLink>
                  <SidebarLink
                    href="/favorites"
                    icon={StarIcon}
                    active={pathname.startsWith("/favorites")}
                  >
                    Favorites
                  </SidebarLink>
                  <SidebarLink
                    href="/friends"
                    icon={UserGroupIcon}
                    active={pathname.startsWith("/friends")}
                  >
                    Friends
                  </SidebarLink>
                </ul>
              </li>
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  <SidebarLink
                    href="/flights"
                    icon={GiftTopIcon}
                    active={pathname.startsWith("/flights")}
                  >
                    Flights
                  </SidebarLink>
                </ul>
              </li>
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  <SidebarLink
                    href="/bottles"
                    icon={BottleIcon}
                    active={pathname.startsWith("/bottles")}
                  >
                    Bottles
                  </SidebarLink>
                  <SidebarLink
                    href="/distillers"
                    icon={DistillerIcon}
                    active={pathname.startsWith("/distillers")}
                  >
                    Distillers
                  </SidebarLink>
                  <SidebarLink
                    href="/brands"
                    icon={BrandIcon}
                    active={pathname.startsWith("/brands")}
                  >
                    Brands
                  </SidebarLink>
                  <SidebarLink
                    href="/brands"
                    icon={BottlerIcon}
                    active={pathname.startsWith("/bottlers")}
                  >
                    Bottlers
                  </SidebarLink>
                </ul>
              </li>
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  <SidebarLink
                    href={config.GITHUB_REPO}
                    icon={CodeBracketSquareIcon}
                  >
                    GitHub
                  </SidebarLink>
                  <SidebarLink
                    href={config.DISCORD_LINK}
                    icon={ChatBubbleLeftIcon}
                  >
                    Discord
                  </SidebarLink>
                  <SidebarLink
                    href="/about"
                    icon={InformationCircleIcon}
                    active={pathname.startsWith("/about")}
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
