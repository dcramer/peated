import { ReactNode } from "react";
import classNames from "../lib/classNames";

type Props = {
  noMobile?: boolean;
  children?: ReactNode;
};

export default ({ noMobile, children }: Props) => {
  return (
    <header
      className={classNames(
        "h-10 sm:h-16 overflow-hidden",
        noMobile ? "hidden sm:block" : ""
      )}
    >
      <div className="fixed bg-peated left-0 right-0 z-10">
        <div className="mx-auto max-w-4xl px-2 sm:px-6 lg:px-8 flex w-full max-w-4xl items-center justify-between h-10 sm:h-16">
          {children}
        </div>
      </div>
    </header>
  );
};
