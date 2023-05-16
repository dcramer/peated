import { ReactNode } from "react";

type Props = {
  title: ReactNode;
  children: ReactNode;
};

export default function Tooltip({ title, children }: Props) {
  return (
    <div className="group relative inline-flex cursor-help">
      {children}
      <span className="w-max-48 absolute right-0 top-6 w-48 scale-0 items-center justify-center rounded bg-slate-700 p-2 text-center text-xs text-slate-400 transition-all group-hover:scale-100 group-focus:scale-100 group-active:scale-100">
        {title}
      </span>
    </div>
  );
}
