import type { ReactNode } from "react";

export default function ActivityRailSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="border-highlight mb-2 flex items-center border-l-2 px-2 text-sm font-semibold text-slate-300">
        <span>{title}</span>
        {badge && (
          <span
            className="bg-highlight/10 text-highlight ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            title="Work in progress"
          >
            {badge}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}
