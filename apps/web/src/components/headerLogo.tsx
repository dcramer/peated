import PeatedGlyph from "@peated/web/assets/glyph.svg?react";
import PeatedLogo from "@peated/web/assets/logo.svg?react";
import { Link } from "@tanstack/react-router";

export default function HeaderLogo() {
  return (
    <>
      <div className="logo relative hidden sm:block">
        <Link to="/" className="items-center sm:flex">
          <PeatedLogo className="h-8 w-auto" />
          <div className="mt-2 ml-2 inline-block w-auto rounded bg-slate-700 px-2 py-1 font-medium text-white text-xs lowercase opacity-90">
            Beta
          </div>
        </Link>
      </div>
      <div className="logo flex sm:hidden">
        <Link to="/">
          <PeatedGlyph className="h-8 w-auto" />
        </Link>
      </div>
    </>
  );
}
