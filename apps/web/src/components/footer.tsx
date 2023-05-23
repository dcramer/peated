import {
  BuildingOfficeIcon,
  GlobeAmericasIcon,
  UserGroupIcon,
} from "@heroicons/react/20/solid";
import { ReactComponent as PeatedGlyph } from "../assets/glyph.svg";
import useAuth from "../hooks/useAuth";
import NavLink from "./navLink";
import NotificationsPanel from "./notifications/panel";

export default function Footer() {
  const { user } = useAuth();
  if (!user) return;
  return (
    <footer className="footer block h-14 overflow-hidden sm:hidden sm:h-20">
      <div className="fixed bottom-0 left-0 right-0 z-10">
        <nav className="sm:h-18 mx-auto mb-4 flex h-14 w-full max-w-4xl items-center justify-center gap-x-6 px-3 sm:mb-0 sm:px-3 lg:px-0">
          <NavLink to="/">
            <GlobeAmericasIcon className="h-8 w-8 sm:h-9 sm:w-9" />
          </NavLink>
          <NavLink to="/entities">
            <BuildingOfficeIcon className="h-8 w-8 sm:h-9 sm:w-9" />
          </NavLink>

          <NavLink
            to="/search?tasting"
            className="focus:ring-highlight relative -mt-5 flex max-w-xs items-center rounded border-y border-b-slate-800 border-t-slate-700 bg-slate-950 text-sm text-slate-500 hover:bg-slate-700 focus:outline-none focus:ring"
          >
            <PeatedGlyph className="m-5 h-9 w-9" />
          </NavLink>
          <NavLink to="/friends">
            <UserGroupIcon className="h-8 w-8 sm:h-9 sm:w-9" />
          </NavLink>
          <NotificationsPanel />
        </nav>
      </div>
    </footer>
  );
}
