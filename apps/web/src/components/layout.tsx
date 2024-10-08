import { Suspense, type ReactNode } from "react";
import classNames from "../lib/classNames";
import AppFooter from "./appFooter";
import AppHeader from "./appHeader";
import Footer from "./footer";
import Header from "./header";
import Sidebar from "./sidebar";

export default function Layout({
  children,
  header,
  footer,
  sidebar,
  rightSidebar,
  noMargin,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  sidebar?: ReactNode;
  rightSidebar?: ReactNode;
  noMargin?: boolean;
}) {
  return (
    <>
      {header !== undefined ? (
        header
      ) : (
        <Header>
          <AppHeader />
        </Header>
      )}

      {sidebar ?? <Sidebar />}

      <div className="flex">
        <main className="w-full max-w-7xl flex-auto lg:pl-64">
          <div className={classNames("mx-auto", noMargin ? "" : "py-4 lg:p-8")}>
            {children}
          </div>
        </main>

        {rightSidebar ? (
          <div className="hidden lg:z-20 lg:w-96 lg:flex-col xl:flex">
            <Suspense>{rightSidebar}</Suspense>
          </div>
        ) : null}
      </div>

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
