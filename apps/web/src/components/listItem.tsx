import { ElementType, ReactNode } from "react";
import classNames from "../lib/classNames";

export default ({
  children,
  noHover = false,
  as: Component = "li",
}: {
  children?: ReactNode;
  noHover?: boolean;
  as?: ElementType;
}) => {
  return (
    <Component
      className={classNames(
        "card group relative",
        noHover ? "" : "hover:bg-slate-900",
      )}
    >
      <div className="mx-auto max-w-7xl justify-between gap-x-6 px-4 sm:px-6 lg:px-8">
        <div className="card-body flex items-center gap-x-4">{children}</div>
      </div>
    </Component>
  );
};
