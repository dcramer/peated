import { GlobeAmericasIcon, UserGroupIcon } from "@heroicons/react/20/solid";
import { StarIcon } from "@heroicons/react/24/outline";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import NavLink from "./navLink";
import NotificationsPanel from "./notifications/panel";

export default function AppFooter() {
  return (
    <nav className="mx-auto flex min-h-14 w-full max-w-4xl items-center justify-center gap-x-6 px-3 sm:min-h-18 sm:px-3 lg:px-0">
      <NavLink href="/">
        <GlobeAmericasIcon className="h-8 w-8 sm:h-9 sm:w-9" />
      </NavLink>
      <NavLink href="/favorites">
        <StarIcon className="h-8 w-8 sm:h-9 sm:w-9" />
      </NavLink>

      <NavLink
        href="/search?tasting"
        className="-mt-5 relative flex max-w-xs items-center rounded border-t border-t-slate-700 bg-slate-950 text-muted text-sm hover:bg-slate-700 focus:outline-none focus:ring focus:ring-highlight"
      >
        <PeatedGlyph className="m-5 h-9 w-9" />
      </NavLink>
      <NavLink href="/friends">
        <UserGroupIcon className="h-8 w-8 sm:h-9 sm:w-9" />
      </NavLink>
      <NotificationsPanel />
    </nav>
  );
}
