import { toTitleCase } from "@peated/shared/lib/strings";
import { Link } from "react-router-dom";
import { Tag } from "../types";

export function TagDistribution({
  tags,
  totalCount,
}: {
  tags: Tag[];
  totalCount: number;
}) {
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

  const visibleTags = tags.slice(0, 7);

  const totalCountVisible = visibleTags.reduce(
    (acc, tag) => acc + tag.count,
    0,
  );

  const results = [
    ...visibleTags.map((t) => ({
      ...t,
      name: toTitleCase(t.tag),
    })),
    // ...(totalCount !== totalCountVisible
    //   ? [{ name: "Other", count: totalCount - totalCountVisible, tag: null }]
    //   : []),
  ].sort((a, b) => b.count - a.count);

  return (
    <div className="relative mb-4 flex flex-col space-y-1 text-xs font-bold">
      {results.map((t, index) => {
        const pct = (t.count / totalCount) * 100;
        return t.tag ? (
          <Link
            key={t.name}
            className={`${colorNames[index]} flex h-6 items-center justify-end rounded-r`}
            style={{ width: `${pct}%` }}
            to={`/bottles?tag=${encodeURIComponent(t.tag)}`}
          >
            <span className="truncate px-2">{t.name}</span>
          </Link>
        ) : (
          <div
            key={t.name}
            className={`${colorNames[index]} flex h-6 items-center justify-end rounded-r`}
            style={{ width: `${pct}%` }}
          >
            <span className="truncate px-2">{t.name}</span>
          </div>
        );
      })}
    </div>
  );
}
