import type { ElementType, ReactNode } from "react";
import classNames from "../lib/classNames";

export default function PageHeader({
  title,
  titleExtra,
  metadata,
  icon: Icon,
  compact = false,
}: {
  title: string | ReactNode;
  titleExtra?: ReactNode;
  metadata?: ReactNode;
  icon?: ElementType;
  compact?: boolean;
}) {
  return (
    <div
      className={classNames(
        "flex w-full flex-wrap justify-center gap-x-3 lg:flex-nowrap lg:justify-start",
        compact ? "my-3 gap-y-2" : "my-4 gap-y-4",
      )}
    >
      {!!Icon && (
        <div
          className={classNames("hidden lg:block", compact ? "w-10" : "w-14")}
        >
          <Icon className={classNames("w-auto", compact ? "h-10" : "h-14")} />
        </div>
      )}

      <div className="flex flex-auto flex-col items-center justify-center truncate lg:w-auto lg:items-start">
        <h1
          className={classNames(
            "max-w-full truncate text-center font-semibold lg:mx-0 lg:text-left",
            compact ? "text-xl" : "text-2xl",
          )}
        >
          {title}
        </h1>
        {titleExtra}
      </div>

      {!!metadata && (
        <div className="text-muted flex w-full min-w-[150px] flex-col items-center justify-center gap-x-1 lg:w-auto lg:items-end">
          {metadata}
        </div>
      )}
    </div>
  );
}
