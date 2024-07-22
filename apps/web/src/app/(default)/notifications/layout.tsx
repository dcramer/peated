import "@fontsource/raleway/index.css";
import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import "@peated/web/styles/index.css";
import { type Metadata } from "next";
import React from "react";
export const metadata: Metadata = {
  title: "Notifications",
};

export default async function DefaultLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Tabs border>
        <TabItem as={Link} controlled href="/notifications">
          Unread
        </TabItem>
        <TabItem as={Link} controlled href="/notifications/all">
          All
        </TabItem>
      </Tabs>
      {children}
    </>
  );
}
