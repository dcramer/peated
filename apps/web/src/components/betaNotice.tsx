import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import type { ReactNode } from "react";

export default function BetaNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center border border-orange-300 p-2 text-orange-300 text-xs">
      <div className="flex-shrink-0">
        <ExclamationTriangleIcon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="ml-2">{children}</div>
    </div>
  );
}
