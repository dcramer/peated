import classNames from "../lib/classNames";
import AppHeader from "./appHeader";
import Header from "./header";

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
          splash ? "bg-peated text-white flex" : "bg-white"
        }`}
      >
        {!noHeader && (
          <Header noMobile={noMobileHeader}>{header || <AppHeader />}</Header>
        )}
        <main
          className={classNames(
            "mx-auto max-w-4xl m-h-screen relative",
            gutter && "sm:px-6 lg:px-8 sm:py-6 lg:py-8",
            gutter && !noMobileGutter && "px-2 py-2",
            splash && "flex-1 self-center sm:max-w-sm px-6 py-12 lg:px-8"
          )}
        >
          {children}
        </main>
      </div>
    </>
  );
}
