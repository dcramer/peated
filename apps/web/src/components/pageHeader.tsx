import type { ElementType, ReactNode } from "react";

export default function PageHeader({
  title,
  titleExtra,
  metadata,
  icon: Icon,
}: {
  title: string | ReactNode;
  titleExtra?: ReactNode;
  metadata?: ReactNode;
  icon?: ElementType;
}) {
  return (
    <div className="my-4 flex w-full flex-wrap justify-center gap-x-3 gap-y-4 lg:flex-nowrap lg:justify-start">
      {!!Icon && (
        <div className="hidden w-14 lg:block">
          <Icon className="h-14 w-auto" />
        </div>
      )}

      <div className="flex flex-auto flex-col items-center justify-center truncate lg:w-auto lg:items-start">
        <h1 className="max-w-full truncate text-center text-2xl font-semibold lg:mx-0 lg:text-left">
          {title}
        </h1>
        {titleExtra}
      </div>

      {!!metadata && (
        <div className="text-light flex w-full min-w-[150px] flex-col items-center justify-center gap-x-1 lg:w-auto lg:items-end">
          {metadata}
        </div>
      )}
    </div>
  );
}
