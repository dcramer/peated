import Link from "@peated/web/components/link";

import PeatedGlyph from "@peated/web/assets/glyph.svg";
import PeatedLogo from "@peated/web/assets/logo.svg";

export default function HeaderLogo() {
  return (
    <Link
      href="/"
      aria-label="Peated home"
      className="text-muted hover:text-white"
    >
      <PeatedGlyph className="h-8 w-auto sm:hidden" />
      <PeatedLogo className="hidden h-7 w-auto sm:block" />
    </Link>
  );
}
