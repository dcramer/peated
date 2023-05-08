import { ReactNode } from "react";
import { XCircleIcon } from "@heroicons/react/20/solid";

export default ({ children }: { children: ReactNode }) => {
  return (
    <div className="sm:rounded bg-red-50 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3 text-red-800">{children}</div>
      </div>
    </div>
  );
};
