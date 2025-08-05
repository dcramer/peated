"use client";

import { HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/20/solid";
import { useRouter, useSearchParams } from "next/navigation";
import classNames from "../lib/classNames";

type MinRating = -1 | 1 | 2 | null;

const ratingLevels = [
  {
    value: null,
    label: "All",
    description: "Show all bottles",
  },
  {
    value: -1 as const,
    label: "Any Rating",
    icon: HandThumbDownIcon,
    description: "Rated bottles only",
    className: "hover:bg-slate-800 data-[active=true]:bg-slate-700",
  },
  {
    value: 1 as const,
    label: "Sip or Better",
    icon: HandThumbUpIcon,
    description: "Worth trying",
    className: "hover:bg-slate-800 data-[active=true]:bg-slate-700",
  },
  {
    value: 2 as const,
    label: "Savor",
    icon: HandThumbUpIcon,
    isDouble: true,
    description: "Highly recommended",
    className: "hover:bg-slate-800 data-[active=true]:bg-slate-700",
  },
];

export default function SimpleRatingFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentMinRating = searchParams.get("minRating")
    ? Number(searchParams.get("minRating"))
    : null;

  const handleSelect = (minRating: MinRating) => {
    const params = new URLSearchParams(searchParams);

    if (minRating === null) {
      params.delete("minRating");
    } else {
      params.set("minRating", String(minRating));
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
          data-active={currentMinRating === level.value}
          className={classNames(
            "rounded-lg border px-3 py-2 transition-all",
            "flex items-center gap-2 text-sm",
            level.value === null
              ? "hover:bg-slate-800 data-[active=true]:bg-slate-700"
              : level.className,
            currentMinRating === level.value
              ? "border-slate-600 font-semibold"
              : "border-slate-700",
          )}
          title={level.description}
        >
          {level.icon && (
            <div className="flex items-center">
              <level.icon className="h-4 w-4" />
              {level.isDouble && <level.icon className="h-4 w-4" />}
            </div>
          )}
          <span>{level.label}</span>
        </button>
      ))}
    </div>
  );
}
