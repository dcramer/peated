import type { ReactNode } from "react";
import classNames from "../lib/classNames";

export default function LayoutSplash({
  children,
  fullWidth = false,
}: {
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <main
      className={classNames(
        "mx-auto flex h-screen items-center justify-center p-4 lg:p-8",
        fullWidth ? "" : "max-w-xl",
      )}
    >
      <div className="flex-auto">{children}</div>
    </main>
  );
}
