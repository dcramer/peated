import type { ReactNode } from "react";

export default ({ children }: { children: ReactNode }) => {
  return <div className="mt-2 text-sm leading-6 text-gray-400">{children}</div>;
};
