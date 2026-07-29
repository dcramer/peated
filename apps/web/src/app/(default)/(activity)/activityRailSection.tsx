import type { ReactNode } from "react";

export default function ActivityRailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="border-highlight mb-2 border-l-2 px-2 text-sm font-semibold text-slate-300">
        {title}
      </h2>
      {children}
    </section>
  );
}
