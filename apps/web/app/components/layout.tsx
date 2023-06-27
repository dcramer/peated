import type { ReactNode } from "react";

// import { AppFooter } from "./appFooter";
// import AppHeader from "./appHeader";
// import Footer from "./footer";
// import Header from "./header";

import { FolderIcon, HomeIcon, UsersIcon } from "@heroicons/react/24/outline";
import { AppFooter } from "./appFooter";
import AppHeader from "./appHeader";
import Footer from "./footer";
import Header from "./header";
import Sidebar from "./sidebar";

const navigation = [
  { name: "Activity", href: "/", icon: HomeIcon, current: true },
  { name: "Bottles", href: "/bottles", icon: UsersIcon, current: false },
  {
    name: "Brands & Distillers",
    href: "/entities",
    icon: FolderIcon,
    current: false,
  },
];

export default function Layout({
  children,
  header,
  footer,
  splash,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  splash?: boolean;
  onSave?: any;
}) {
  if (splash) {
    return (
      <main className="mx-auto flex h-screen max-w-xl items-center justify-center p-4 lg:p-8">
        <div className="flex-1">{children}</div>
      </main>
    );
  }

  return (
    <>
      {header !== undefined ? (
        header
      ) : (
        <Header mobileOnly>
          <AppHeader />
        </Header>
      )}

      <Sidebar />

      <main className="max-w-6xl lg:pl-64">
        <div className="mx-auto lg:p-8">{children}</div>
      </main>

      {footer !== undefined ? (
        footer
      ) : (
        <Footer mobileOnly>
          <AppFooter />
        </Footer>
      )}
    </>
  );
}
