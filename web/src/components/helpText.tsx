import { ReactNode } from "react";

export default ({ children }: { children: ReactNode }) => {
  return <p className="mt-2 text-sm leading-6 text-gray-600">{children}</p>;
};
