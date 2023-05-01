import { ReactNode } from "react";

export default ({ children }: { children: ReactNode }) => {
  return (
    <div className="mb-4 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
      <div className="col-span-full">{children}</div>
    </div>
  );
};
