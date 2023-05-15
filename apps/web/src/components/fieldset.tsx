import { ReactNode } from "react";

export default ({ children }: { children: ReactNode }) => {
  return <div className="isolate space-y-4">{children}</div>;
};
