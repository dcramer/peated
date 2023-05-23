import { ReactNode } from "react";
import classNames from "../lib/classNames";

type Props = {
  noMobile?: boolean;
  color?: "default" | "primary";
  children?: ReactNode;
};

export default ({ noMobile, children, color = "default" }: Props) => {
  return (
    <header
      className={classNames(
        "header h-14 flex-shrink-0 overflow-hidden sm:h-20",
        noMobile ? "hidden sm:block" : "",
      )}
    >
      <div
        className={classNames(
          "fixed left-0 right-0 z-10",
          color === "primary"
            ? "main-gradient backdrop-blur"
            : "border-b border-b-slate-700 bg-slate-950",
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-3 sm:h-20 sm:px-3 lg:px-0">
          {children}
        </div>
      </div>
    </header>
  );
};
