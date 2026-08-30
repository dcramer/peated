import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NotificationPageFrame } from "./notificationPageFrame.stylex";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <NotificationPageFrame>{children}</NotificationPageFrame>;
}
