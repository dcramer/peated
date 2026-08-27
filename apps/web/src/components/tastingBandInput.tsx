"use client";

import { TASTING_BANDS, type TastingBandId } from "@peated/server/constants";
import type { FieldError } from "react-hook-form";
import classNames from "../lib/classNames";
import FormField from "./formField";

export default function TastingBandInput({
  value,
  error,
  disabled,
  onChange,
}: {
  value?: TastingBandId | null;
  error?: FieldError;
  disabled?: boolean;
  onChange: (value: TastingBandId | null) => void;
}) {
  return (
    <FormField
      label="How was it?"
      error={error}
      helpText="Choose a broad band. You can leave this blank."
    >
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {TASTING_BANDS.map((band) => {
          const selected = value === band.id;
          return (
            <button
              key={band.id}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              className={classNames(
                "rounded border px-3 py-2 text-left text-sm disabled:opacity-50",
                selected
                  ? "border-peated bg-slate-700"
                  : "border-slate-700 hover:bg-slate-800",
              )}
              onClick={() => onChange(selected ? null : band.id)}
            >
              <span className="block font-semibold">{band.label}</span>
              <span className="text-muted text-xs">
                {band.min}–{band.max}
              </span>
            </button>
          );
        })}
      </div>
    </FormField>
  );
}
