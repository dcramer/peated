import classNames from "../lib/classNames";
import AppHeader from "./appHeader";

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
  return (
    <>
      <div
        className={`min-h-full h-screen overflow-y-auto ${
          splash ? "bg-peated text-white" : "bg-white"
        }`}
      >
        {!noHeader && (
          <header
            className={classNames(
              "h-10 sm:h-16 overflow-hidden",
              noMobileHeader ? "hidden sm:block" : ""
            )}
          >
            <div className="fixed bg-peated left-0 right-0 z-10">
              <div className="mx-auto max-w-4xl px-2 sm:px-6 lg:px-8 flex min-w-full max-w-4xl items-center justify-between h-10 sm:h-16">
                {header || <AppHeader />}
              </div>
            </div>
          </header>
        )}
        <main
          className={classNames(
            "mx-auto max-w-4xl m-h-screen relative",
            gutter && "sm:px-6 lg:px-8 sm:py-6 lg:py-8",
            gutter && !noMobileGutter && "px-2 py-2"
          )}
        >
          {children}
        </main>
      </div>
    </>
  );
}
