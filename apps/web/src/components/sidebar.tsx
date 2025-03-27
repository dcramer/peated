"use client";

import { MapIcon } from "@heroicons/react/20/solid";
import {
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
import PeatedGlyph from "@peated/web/assets/glyph.svg";
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
                  Record a Tasting
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
                    Home
                  </SidebarLink>
                  <SidebarLink
                    href="/favorites"
                    icon={StarIcon}
                    active={pathname.startsWith("/favorites")}
                  >
                    Favorites
                  </SidebarLink>
                  <SidebarLink
                    href="/tastings"
                    icon={PeatedGlyph}
                    active={pathname.startsWith("/tastings")}
                  >
                    Tastings
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
                    href="/locations"
                    icon={MapIcon}
                    active={pathname.startsWith("/locations")}
                  >
                    Locations
                  </SidebarLink>
                </ul>
              </li>
              <li>
                <ul role="list" className="-mx-2 space-y-1">
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
                    href="/bottlers"
                    icon={BottlerIcon}
                    active={pathname.startsWith("/bottlers")}
                  >
                    Bottlers
                  </SidebarLink>
                </ul>
              </li>
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  <FeedbackSidebarLink />
                  <SidebarLink
                    href="/about"
                    icon={InformationCircleIcon}
                    active={pathname.startsWith("/about")}
                  >
                    About
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
