import { AnimatePresence, motion } from "framer-motion";
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
  gutter,
  noHeader,
  noMobileHeader,
  noMobileGutter,
}: {
  children: any;
  header?: any;
  noHeader?: boolean;
  splash?: boolean;
  gutter?: boolean;
  noMobileGutter?: boolean;
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
            "content m-h-screen relative mx-auto max-w-4xl rounded",
            gutter && "sm:px-6 sm:py-6 lg:px-8 lg:py-8",
            gutter && !noMobileGutter && "px-2 py-2",
            splash && "flex-1 self-center px-6 py-12 sm:max-w-sm lg:px-8",
          )}
        >
          <AnimatePresence>
            <motion.div
              key={location.pathname}
              initial={{ y: 100, opacity: 0 }}
              animate={{
                y: 0,
                opacity: 1,
                transition: { duration: 0.5, ease: "easeInOut" },
              }}
              exit={{
                y: -100,
                opacity: 0,
                transition: { duration: 0.5, ease: "easeInOut" },
              }}
            >
              <Suspense
                fallback={
                  <div className="flex h-screen items-center justify-center">
                    <Spinner />
                  </div>
                }
              >
                {children}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}
