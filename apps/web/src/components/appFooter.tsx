import {
  BuildingOfficeIcon,
  GlobeAmericasIcon,
  UserGroupIcon,
} from "@heroicons/react/20/solid";
import { ReactComponent as PeatedGlyph } from "../assets/glyph.svg";
import NavLink from "./navLink";
import NotificationsPanel from "./notifications/panel";

export function AppFooter() {
  return (
    <nav className="sm:min-h-18 min-h-14 mx-auto flex w-full max-w-4xl items-center justify-center gap-x-6 px-3 sm:px-3 lg:px-0">
      <NavLink to="/">
        <GlobeAmericasIcon className="h-8 w-8 sm:h-9 sm:w-9" />
      </NavLink>
      <NavLink to="/entities">
        <BuildingOfficeIcon className="h-8 w-8 sm:h-9 sm:w-9" />
      </NavLink>

      <NavLink
        to="/search?tasting"
        className="focus:ring-highlight relative -mt-5 flex max-w-xs items-center rounded border-t border-t-slate-700 bg-slate-950 text-sm text-slate-500 hover:bg-slate-700 focus:outline-none focus:ring"
      >
        <PeatedGlyph className="m-5 h-9 w-9" />
      </NavLink>
      <NavLink to="/friends">
        <UserGroupIcon className="h-8 w-8 sm:h-9 sm:w-9" />
      </NavLink>
      <NotificationsPanel />
    </nav>
  );
}
