import type { ReactNode } from "react";

import { LocationsIndexFrame } from "../locationPageFrame.stylex";

export default function LocationsLayout({ children }: { children: ReactNode }) {
  return <LocationsIndexFrame>{children}</LocationsIndexFrame>;
}
