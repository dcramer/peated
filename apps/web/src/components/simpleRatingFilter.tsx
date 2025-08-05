"use client";

import { useRouter, useSearchParams } from "next/navigation";
import classNames from "../lib/classNames";

type RatingLevel = "pass" | "sip" | "savor" | null;

const ratingLevels = [
  {
    value: null,
    label: "All",
    description: "Show all bottles",
  },
  {
    value: "pass" as const,
    label: "Pass",
    icon: "🚫",
    description: "Not recommended",
    className: "hover:bg-red-50 data-[active=true]:bg-red-100",
  },
  {
    value: "sip" as const,
    label: "Sip",
    icon: "🥃",
    description: "Worth trying",
    className: "hover:bg-yellow-50 data-[active=true]:bg-yellow-100",
  },
  {
    value: "savor" as const,
    label: "Savor",
    icon: "🥃🥃",
    description: "Highly recommended",
    className: "hover:bg-green-50 data-[active=true]:bg-green-100",
  },
];

export default function SimpleRatingFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentLevel = searchParams.get("ratingLevel") as RatingLevel;

  const handleSelect = (level: RatingLevel) => {
    const params = new URLSearchParams(searchParams);

    if (level === null) {
      params.delete("ratingLevel");
    } else {
      params.set("ratingLevel", level);
    }

    // Reset to first page when changing filters
    params.delete("cursor");

    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      {ratingLevels.map((level) => (
        <button
          key={level.value ?? "all"}
          onClick={() => handleSelect(level.value)}
          data-active={currentLevel === level.value}
          className={classNames(
            "rounded-lg border px-3 py-2 transition-all",
            "flex items-center gap-2 text-sm",
            level.value === null
              ? "hover:bg-slate-50 data-[active=true]:bg-slate-100"
              : level.className,
            currentLevel === level.value
              ? "border-slate-300 font-semibold"
              : "border-slate-200",
          )}
          title={level.description}
        >
          {level.icon && <span>{level.icon}</span>}
          <span>{level.label}</span>
        </button>
      ))}
    </div>
  );
}
