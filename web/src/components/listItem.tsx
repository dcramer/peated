import { ReactNode } from "react";

export default ({ children }: { children?: ReactNode }) => {
  return (
    <li className="group relative py-5 hover:bg-gray-100">
      <div className="mx-auto max-w-7xl justify-between gap-x-6 px-4 sm:px-6 lg:px-8">
        <div className="flex gap-x-4 items-center">{children}</div>
      </div>
    </li>
  );
};
