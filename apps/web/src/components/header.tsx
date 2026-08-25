import type { ReactNode } from "react";
import classNames from "../lib/classNames";

type Props = {
  mobileOnly?: boolean;
  semantic?: boolean;
  sidebarOffset?: boolean;
  wide?: boolean;
  color?: "default" | "primary";
  children?: ReactNode;
};

export default function Header({
  mobileOnly = false,
  semantic = true,
  sidebarOffset = false,
  wide = false,
  children,
  color = "default",
}: Props) {
  const Element = semantic ? "header" : "div";

  return (
    <div>
      <Element
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
          <div
            className={classNames(
              "flex h-14 w-full lg:h-16",
              sidebarOffset
                ? "max-w-7xl lg:pl-60"
                : wide
                  ? "mx-auto max-w-[104rem]"
                  : "mx-auto max-w-7xl",
            )}
          >
            <div className="flex flex-1 items-center justify-between px-3 lg:px-8">
              {children}
            </div>
          </div>
        </div>
      </Element>
    </div>
  );
}
