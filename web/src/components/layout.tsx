import classNames from "../lib/classNames";
import AppHeader from "./appHeader";

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
              <div className="mx-auto max-w-4xl px-2 sm:px-6 lg:px-8">
                <div className="flex min-w-full max-w-4xl h-10 sm:h-16 items-center justify-between overflow-hidden">
                  {header || <AppHeader />}
                </div>
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-4xl m-h-screen relative">
          {children}
        </main>
      </div>
    </>
  );
}
