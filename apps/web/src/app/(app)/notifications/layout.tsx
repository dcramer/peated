import type { Metadata } from "next";
import type { ReactNode } from "react";

import { noIndexPageMetadata } from "@peated/web/lib/seoMetadata";
import { NotificationPageFrame } from "./notificationPageFrame.stylex";

export const metadata: Metadata = {
  title: "Notifications",
  ...noIndexPageMetadata,
};

export default function NotificationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <NotificationPageFrame>{children}</NotificationPageFrame>;
}
