import { ReactNode } from "react";

export default ({ children }: { children: ReactNode }) => {
  return <div className="space-y relative sm:space-y-2">{children}</div>;
};
