import { ElementType, ReactNode } from "react";
import classNames from "../lib/classNames";

export default ({
  children,
  noHover = false,
  color = "default",
  as: Component = "li",
}: {
  children?: ReactNode;
  noHover?: boolean;
  as?: ElementType;
  color?: "default" | "highlight";
}) => {
  return (
    <Component
      className={classNames(
        "card group relative",
        color === "highlight" ? "bg-highlight text-black" : "",
        noHover ? "" : color === "highlight" ? "" : "hover:bg-slate-900",
      )}
    >
      <div className="mx-auto max-w-7xl justify-between gap-x-6 px-4 sm:px-6 lg:px-8">
        <div className="card-body flex items-center gap-x-4">{children}</div>
      </div>
    </Component>
  );
};
