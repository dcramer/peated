import { AnimatePresence } from "framer-motion";
import { Suspense } from "react";
import { useLocation } from "react-router-dom";
import classNames from "../lib/classNames";
import AppHeader from "./appHeader";
import Header from "./header";
import Spinner from "./spinner";

export default function Layout({
  children,
  header,
  splash,
  noHeader,
  noMobileHeader,
}: {
  children: any;
  header?: any;
  noHeader?: boolean;
  splash?: boolean;
  noMobileHeader?: boolean;
  onSave?: any;
}) {
  const location = useLocation();

  return (
    <>
      <div className={`layout ${splash ? "flex" : ""}`}>
        {!noHeader && (
          <Header noMobile={noMobileHeader}>{header || <AppHeader />}</Header>
        )}

        <main
          className={classNames(
            "content m-h-screen relative mx-auto max-w-4xl",
            splash && "flex-1 self-center px-6 py-12 sm:max-w-sm lg:px-8",
          )}
        >
          <AnimatePresence>
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              {children}
            </Suspense>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}
