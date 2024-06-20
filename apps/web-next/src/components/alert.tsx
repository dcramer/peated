import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import classNames from "@peated/web/lib/classNames";
import type { ReactNode } from "react";

export default ({
  children,
  noMargin = false,
}: {
  children: ReactNode;
  noMargin?: boolean;
}) => {
  return (
    <div className={classNames("p-4", noMargin ? "" : "mb-4")}>
      <div className="flex">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon
            className="h-5 w-5 text-red-500"
            aria-hidden="true"
          />
        </div>
        <div className="ml-3 text-red-500">{children}</div>
      </div>
    </div>
  );
};
