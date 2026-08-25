import { Suspense, type ReactNode } from "react";
import classNames from "../lib/classNames";
import AppHeader from "./appHeader";
import CatalogSidebarSkeleton from "./catalogSidebarSkeleton";
import Header from "./header";

export default function Layout({
  children,
  header,
  footer,
  sidebar,
  leftSidebar,
  noMargin,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  sidebar?: ReactNode;
  leftSidebar?: ReactNode;
  noMargin?: boolean;
}) {
  const hasSidebar = sidebar !== undefined && sidebar !== null;

  return (
    <>
      {header !== undefined ? (
        header
      ) : (
        <Header sidebarOffset={hasSidebar} wide={!hasSidebar && !!leftSidebar}>
          <Suspense>
            <AppHeader showNavigation={!hasSidebar} />
          </Suspense>
        </Header>
      )}

      {sidebar ?? null}

      <div
        className={classNames(
          "flex",
          !hasSidebar && "mx-auto w-full",
          !hasSidebar && (leftSidebar ? "max-w-[104rem]" : "max-w-7xl"),
        )}
      >
        {leftSidebar ? (
          <aside className="hidden shrink-0 bg-slate-950 xl:block xl:w-64">
            <Suspense fallback={<CatalogSidebarSkeleton />}>
              {leftSidebar}
            </Suspense>
          </aside>
        ) : null}

        <main
          className={classNames(
            "w-full max-w-7xl flex-auto",
            hasSidebar && "lg:pl-60",
          )}
        >
          <div className={classNames("mx-auto", noMargin ? "" : "py-4 lg:p-8")}>
            {children}
          </div>
        </main>
      </div>

      {footer ?? null}
    </>
  );
}
