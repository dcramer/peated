import { Link } from "@remix-run/react";

import PeatedGlyph from "./assets/Glyph";
import PeatedLogo from "./assets/Logo";

export default function HeaderLogo() {
  return (
    <>
      <div className="logo hidden items-center sm:flex">
        <Link to="/">
          <PeatedLogo className="h-8 w-auto" />
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
