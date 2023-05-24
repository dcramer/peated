import { ReactNode } from "react";

export default ({ children }: { children: ReactNode }) => {
  return <div className="relative space-y-1">{children}</div>;
};
