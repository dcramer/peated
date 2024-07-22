import Link from "@peated/web/components/link";
import type { ComponentProps } from "react";

type Item = {
  name: string;
  count: number;
  [key: string]: any;
};

export function DistributionChartSkeleton() {
  return (
    <div
      className="animate-pulse rounded bg-slate-900"
      style={{ height: 100 }}
    />
  );
}

export function DistributionChartError() {
  return (
    <div
      className="text-light flex items-center justify-center rounded bg-slate-900 p-3 text-center text-sm"
      style={{ height: 100 }}
    >
      There was an error loading this chart.
    </div>
  );
}

export function DistributionChartEmpty() {
  return (
    <div
      className="text-light flex items-center justify-center rounded bg-slate-900 p-3 text-center text-sm"
      style={{ height: 100 }}
    >
      No information available for this chart.
    </div>
  );
}

const colorNames = [
  // "bg-slate-100 text-black border-slate-700 border",
  "bg-slate-200 text-black border-slate-700 border",
  "bg-slate-300 text-black border-slate-700 border",
  "bg-slate-400 text-black border-slate-700 border",
  "bg-slate-500 text-white border-slate-700 border",
  "bg-slate-600 text-white border-slate-700 border",
  "bg-slate-700 text-white border-slate-700 border",
  "bg-slate-800 text-white border-slate-700 border",
  "bg-slate-900 text-white border-slate-700 border",
];

export function DistributionChartLegend(props: ComponentProps<"div">) {
  return <div className="text-light mb-2 text-xs font-semibold" {...props} />;
}

export default function DistributionChart({
  items,
  totalCount,
  href,
}: {
  items: Item[];
  totalCount: number;
  href?: (item: Item) => string;
}) {
  if (!items.length) {
    return <DistributionChartEmpty />;
  }

  const visibleItems = items.slice(0, 7);

  // const totalCountVisible = visibleTags.reduce(
  //   (acc, tag) => acc + tag.count,
  //   0,
  // );

  const results = [
    ...visibleItems,
    // ...(totalCount !== totalCountVisible
    //   ? [{ name: "Other", count: totalCount - totalCountVisible, tag: null }]
    //   : []),
  ].sort((a, b) => b.count - a.count);

  return (
    <div className="relative flex flex-col space-y-1 truncate text-xs font-bold">
      {results.map((item, index) => {
        const pct = (item.count / totalCount) * 100;
        const itemTo = href && href(item);
        return itemTo ? (
          <Link
            key={item.name}
            className={`${colorNames[index]} flex h-6 items-center justify-end rounded-r`}
            style={{ width: `${pct}%` }}
            href={itemTo}
          >
            <span className="truncate px-2">{item.name}</span>
          </Link>
        ) : (
          <div
            key={item.name}
            className={`${colorNames[index]} flex h-6 items-center justify-end rounded-r`}
            style={{ width: `${pct}%` }}
          >
            <span className="truncate px-2">{item.name}</span>
          </div>
        );
      })}
    </div>
  );
}
