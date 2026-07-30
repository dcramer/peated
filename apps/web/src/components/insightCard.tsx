import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import type { ReactNode } from "react";

export type RankedInsightItem = {
  id: string | number;
  label: string;
  count: number;
  href?: string;
};

function formatCount(count: number, unit: string) {
  return `${count.toLocaleString()} ${unit}${count === 1 ? "" : "s"}`;
}

export function RankedInsightBars({
  items,
  unit,
}: {
  items: RankedInsightItem[];
  unit: string;
}) {
  const largestCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <ol className="space-y-2">
      {items.map((item) => {
        const content = (
          <>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium text-slate-200">
                {item.label}
              </span>
              <span className="text-muted shrink-0 tabular-nums">
                {item.count.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="bg-highlight h-full rounded-full"
                style={{ width: `${(item.count / largestCount) * 100}%` }}
              />
            </div>
          </>
        );

        return (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className="focus-visible:ring-highlight group block rounded focus-visible:outline-none focus-visible:ring-2"
                aria-label={`${item.label}: ${formatCount(item.count, unit)}`}
              >
                {content}
              </Link>
            ) : (
              <div
                aria-label={`${item.label}: ${formatCount(item.count, unit)}`}
              >
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function InsightCard({
  title,
  detail,
  className,
  children,
}: {
  title: string;
  detail?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={classNames(
        "rounded border border-slate-800 bg-slate-950/70 p-3",
        className,
      )}
    >
      <div className="mb-3 flex min-h-8 items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {detail ? (
          <span className="text-muted text-right text-[11px] leading-4">
            {detail}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function InsightCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={classNames(
        "h-44 animate-pulse rounded bg-slate-900",
        className,
      )}
    />
  );
}
