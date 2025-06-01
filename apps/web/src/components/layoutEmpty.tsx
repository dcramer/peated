import PeatedLogo from "@peated/web/assets/logo.svg";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import classNames from "../lib/classNames";

export default function LayoutEmpty({
  children,
  fullWidth,
  withHeader = false,
}: {
  children: ReactNode;
  fullWidth?: boolean;
  withHeader?: boolean;
}) {
  return (
    <main
      className={classNames(
        "mx-auto flex h-screen items-center justify-center p-4 lg:p-8",
        fullWidth ? "" : "max-w-xl"
      )}
    >
      <div className="flex-auto">
        {withHeader && (
          <div className="flex flex-grow items-center justify-center px-4">
            <Link to="/" className="max-w-xs">
              <PeatedLogo className="h-auto w-full text-highlight" />
            </Link>
          </div>
        )}
        <div className="mt-8 flex min-w-sm flex-auto flex-col gap-y-4 rounded px-4 py-6">
          {children}
        </div>
      </div>
    </main>
  );
}
