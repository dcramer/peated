import type { ReactNode } from "react";
import classNames from "../lib/classNames";

type Props = {
  mobileOnly?: boolean;
  color?: "default" | "primary";
  children?: ReactNode;
};

export default function Header({
  mobileOnly = false,
  children,
  color = "default",
}: Props) {
  return (
    <div>
      <header
        className={classNames(
          "h-14 flex-shrink-0 overflow-hidden lg:h-16",
          mobileOnly ? "block lg:hidden" : "",
        )}
      >
        <div
          className={classNames(
            "fixed left-0 right-0 z-30",
            color === "primary"
              ? "main-gradient backdrop-blur"
              : "border-b border-b-slate-700 bg-slate-950",
          )}
        >
          <div className="flex h-14 w-full max-w-7xl lg:h-16 lg:pl-64">
            <div className="flex flex-1 items-center justify-between px-3 lg:px-8">
              {children}
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
