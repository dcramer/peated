import { ReactNode } from "react";

export default ({ children }: { children: ReactNode }) => {
  return (
    <div className="isolate space-y sm:border border-b border-gray-300 sm:rounded-md shadow-sm divide-y divide-gray-300">
      {children}
    </div>
  );
};
