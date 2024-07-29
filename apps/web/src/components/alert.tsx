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
        "gap-x-3 p-3 font-semibold opacity-90 sm:rounded",
        type === "success" ? "text-l-50 bg-lime-700" : "",
        type === "warn" ? "bg-amber-700 text-amber-50" : "",
        type === "error" ? "bg-red-700 text-red-50" : "",
        type === "default"
          ? "border border-slate-800 bg-slate-900 text-slate-300"
          : "",
        noMargin ? "" : "mb-4",
      )}
    >
      <div className="flex items-center">
        {type === "error" ? (
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />
          </div>
        ) : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
