import { useLocation } from "react-router-dom";
import classNames from "../lib/classNames";
import AppHeader from "./appHeader";
import Footer from "./footer";
import Header from "./header";

export default function Layout({
  children,
  header,
  splash,
  noHeader,
  noFooter,
  noMobileHeader,
}: {
  children: any;
  header?: any;
  noHeader?: boolean;
  noFooter?: boolean;
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
          {children}
        </main>

        {!noFooter && <Footer />}
      </div>
    </>
  );
}
