import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import classNames from "@peated/web/lib/classNames";
import type { ReactNode } from "react";

export default function Alert({
  children,
  type = "error",
  noMargin = false,
}: {
  children: ReactNode;
  type?: "success" | "warn" | "error" | "default";
  noMargin?: boolean;
}) {
  return (
    <div
      className={classNames(
        "flex items-start gap-x-3 p-4 font-semibold opacity-90 sm:rounded",
        type === "success" ? "bg-lime-700 text-l-50" : "",
        type === "warn" ? "bg-amber-700 text-amber-50" : "",
        type === "error" ? "bg-red-700 text-red-50" : "",
        type === "default"
          ? "border border-slate-800 bg-slate-900 text-slate-300"
          : "",
        noMargin ? "" : "lg:mb-8"
      )}
    >
      {type === "error" ? (
        <div className="hidden flex-shrink-0 lg:block">
          <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />
        </div>
      ) : null}
      <div>{children}</div>
    </div>
  );
}
