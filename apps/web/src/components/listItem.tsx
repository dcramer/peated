import { ReactNode } from "react";
import classNames from "../lib/classNames";

export default ({
  children,
  noHover = false,
}: {
  children?: ReactNode;
  noHover?: boolean;
}) => {
  return (
    <li
      className={classNames(
        "group relative py-5",
        noHover ? "" : "hover:bg-gray-100"
      )}
    >
      <div className="mx-auto max-w-7xl justify-between gap-x-6 px-4 sm:px-6 lg:px-8">
        <div className="flex gap-x-4 items-center">{children}</div>
      </div>
    </li>
  );
};
