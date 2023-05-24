import { ReactNode } from "react";
import { Helmet } from "react-helmet";

import classNames from "../lib/classNames";
import { AppFooter } from "./appFooter";
import AppHeader from "./appHeader";
import Footer from "./footer";
import Header from "./header";

export default function Layout({
  children,
  title,
  header,
  footer,
  splash,
}: {
  children: ReactNode;
  title?: string;
  header?: ReactNode;
  footer?: ReactNode;
  splash?: boolean;
  onSave?: any;
}) {
  return (
    <>
      <Helmet>
        <title>{title ? `${title} | Peated` : "Peated"}</title>
      </Helmet>
      <div className="layout flex min-h-screen flex-1 flex-col">
        {header !== undefined ? (
          header
        ) : (
          <Header color="primary">
            <AppHeader />
          </Header>
        )}

        <main
          className={classNames(
            "content relative mx-auto flex w-full max-w-4xl flex-1 flex-col",
            splash && "flex-1 self-center px-6 py-12 sm:max-w-sm lg:px-8",
          )}
        >
          {children}
        </main>

        {footer !== undefined ? (
          footer
        ) : (
          <Footer mobileOnly>
            <AppFooter />
          </Footer>
        )}
      </div>
    </>
  );
}
