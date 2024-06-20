import type { ReactNode } from "react";
import classNames from "../lib/classNames";

export default function Footer({
  children,
  mobileOnly = false,
}: {
  children?: ReactNode;
  mobileOnly?: boolean;
}) {
  return (
    <footer
      className={classNames(
        "h-24 flex-shrink-0 overflow-hidden text-white",
        mobileOnly ? "block lg:hidden" : "",
      )}
    >
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-t-slate-700 bg-slate-950 pb-2 sm:pb-0">
        <div className="sm:min-h-20 min-h-14 mx-auto flex w-full max-w-4xl items-center justify-center gap-x-6 px-3 pb-4 sm:px-3 lg:px-0">
          {children}
        </div>
      </div>
    </footer>
  );
}
