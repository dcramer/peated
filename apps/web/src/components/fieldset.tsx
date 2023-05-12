import { ReactNode } from "react";

export default ({ children }: { children: ReactNode }) => {
  return (
    <div className="space-y isolate divide-y divide-gray-300 border-y border-gray-300 shadow-sm sm:rounded sm:border">
      {children}
    </div>
  );
};
