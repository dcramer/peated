import { XCircleIcon } from "@heroicons/react/20/solid";
import type { ReactNode } from "react";

export default ({ children }: { children: ReactNode }) => {
  return (
    <div className="mb-4 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
        </div>
        <div className="ml-3 text-red-500">{children}</div>
      </div>
    </div>
  );
};
