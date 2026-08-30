import type { ReactNode } from "react";

import { ActivityPageFrame } from "./activityPageFrame.stylex";

export default function ActivityLayout({ children }: { children: ReactNode }) {
  return <ActivityPageFrame>{children}</ActivityPageFrame>;
}
