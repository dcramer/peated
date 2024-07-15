import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid";
import { type ComponentPropsWithoutRef } from "react";

export default function Legend({
  children,
  title,
  isCollapsed,
  onCollapse,
  ...props
}: ComponentPropsWithoutRef<"legend"> & {
  title: string;
  isCollapsed?: boolean;
  onCollapse?: () => void;
}) {
  return (
    <legend
      className="-mb-1 flex w-full items-center bg-slate-900 px-4 py-6 font-bold text-white"
      {...props}
    >
      <div className="flex-grow">{title}</div>
      {children}
      {isCollapsed !== undefined && onCollapse && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCollapse();
          }}
          className="ml-3"
        >
          {isCollapsed ? (
            <ArrowUpIcon className="h-5 w-5" />
          ) : (
            <ArrowDownIcon className="h-5 w-5" />
          )}
        </button>
      )}
    </legend>
  );
}
