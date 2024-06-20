import Link from "next/link";

import PeatedGlyph from "./assets/Glyph";
import PeatedLogo from "./assets/Logo";

export default function HeaderLogo() {
  return (
    <>
      <div className="logo relative hidden sm:block">
        <Link href="/" className="items-center sm:flex">
          <PeatedLogo className="h-8 w-auto" />
          <div className="ml-2 mt-2 inline-block w-auto rounded bg-slate-700 px-2 py-1 text-xs font-medium lowercase text-white opacity-90">
            Beta
          </div>
        </Link>
      </div>
      <div className="logo flex sm:hidden">
        <Link href="/">
          <PeatedGlyph className="h-8 w-auto" />
        </Link>
      </div>
    </>
  );
}
