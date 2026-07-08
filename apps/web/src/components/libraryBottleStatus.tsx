"use client";

import classNames from "@peated/web/lib/classNames";

export const COLLECTION_BOTTLE_STATUS_VALUES = [
  "sealed",
  "open",
  "empty",
] as const;

export type CollectionBottleStatus =
  (typeof COLLECTION_BOTTLE_STATUS_VALUES)[number];

export type CollectionBottleStatusValue = CollectionBottleStatus | null;

export const COLLECTION_BOTTLE_STATUS_META: Record<
  CollectionBottleStatus,
  {
    label: string;
    chipClassName: string;
    selectedClassName: string;
    labelClassName: string;
  }
> = {
  sealed: {
    label: "Sealed",
    chipClassName:
      "border-emerald-800/70 text-emerald-200 hover:bg-emerald-950",
    selectedClassName: "border-emerald-500 bg-emerald-500 text-black",
    labelClassName: "border-emerald-800/80 bg-emerald-950/70 text-emerald-200",
  },
  open: {
    label: "Open",
    chipClassName: "border-sky-800/70 text-sky-200 hover:bg-sky-950",
    selectedClassName: "border-sky-500 bg-sky-500 text-black",
    labelClassName: "border-sky-800/80 bg-sky-950/70 text-sky-200",
  },
  empty: {
    label: "Empty",
    chipClassName: "border-slate-700 text-slate-300 hover:bg-slate-800",
    selectedClassName: "border-slate-400 bg-slate-200 text-slate-950",
    labelClassName: "border-slate-700 bg-slate-900 text-slate-300",
  },
};

export function getCollectionBottleStatusLabel(
  status: CollectionBottleStatusValue | undefined,
) {
  return status ? COLLECTION_BOTTLE_STATUS_META[status].label : "Not set";
}

export function CollectionBottleStatusLabel({
  status,
}: {
  status?: CollectionBottleStatusValue;
}) {
  if (!status) return null;

  const meta = COLLECTION_BOTTLE_STATUS_META[status];

  return (
    <span
      className={classNames(
        "inline-flex h-7 items-center self-start rounded border px-2 text-xs font-semibold",
        meta.labelClassName,
      )}
    >
      {meta.label}
    </span>
  );
}

export function CollectionBottleStatusChips({
  value,
  disabled = false,
  onChange,
}: {
  value?: CollectionBottleStatusValue;
  disabled?: boolean;
  onChange: (status: CollectionBottleStatus) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-start gap-1"
      aria-label="Bottle status"
    >
      {COLLECTION_BOTTLE_STATUS_VALUES.map((status) => {
        const meta = COLLECTION_BOTTLE_STATUS_META[status];
        const selected = value === status;

        return (
          <button
            key={status}
            type="button"
            disabled={disabled || selected}
            aria-pressed={selected}
            onClick={() => onChange(status)}
            className={classNames(
              "inline-flex h-7 items-center rounded border px-2 text-xs font-semibold transition-colors disabled:cursor-auto disabled:opacity-80",
              selected
                ? meta.selectedClassName
                : "bg-slate-950 " + meta.chipClassName,
            )}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
