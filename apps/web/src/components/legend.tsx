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
      className="relative -mb-1 flex w-full items-center bg-slate-800 px-4 py-6 font-bold text-white"
      {...props}
    >
      <div className="flex-grow text-lg">{title}</div>
      {isCollapsed !== undefined && onCollapse && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCollapse();
          }}
          className="absolute inset-0 z-10 cursor-pointer"
        />
      )}
      <div className="z-20 inline-block">{children}</div>
      {isCollapsed !== undefined &&
        onCollapse &&
        (isCollapsed ? (
          <ArrowUpIcon className="ml-3 h-5 w-5" />
        ) : (
          <ArrowDownIcon className="ml-3 h-5 w-5" />
        ))}
    </legend>
  );
}
