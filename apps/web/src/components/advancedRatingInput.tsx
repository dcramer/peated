"use client";

import {
  ADVANCED_RATING_BANDS,
  getAdvancedRatingBand,
} from "@peated/server/constants";
import type { FieldError } from "react-hook-form";
import FormField from "./formField";
import Link from "./link";
import TextInput from "./textInput";

export default function AdvancedRatingInput({
  name = "score",
  value,
  error,
  disabled,
  onChange,
}: {
  name?: string;
  value?: number | null;
  error?: FieldError;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  const band =
    value === null || value === undefined
      ? undefined
      : getAdvancedRatingBand(value);

  return (
    <FormField
      label="100-point score"
      htmlFor={`f-${name}`}
      error={error}
      helpText={
        <>
          Score the whisky in the glass, excluding price, rarity, packaging, and
          reputation. One point is personal comparative precision, not an
          objective measurement.{" "}
          <Link href="/about/ratings" className="underline">
            How ratings work
          </Link>
        </>
      }
    >
      <div className="mt-2 flex items-center gap-3">
        <TextInput
          id={`f-${name}`}
          name={name}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          value={value ?? ""}
          placeholder="85"
          suffixLabel="/ 100"
          className="text-lg font-semibold"
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue === "" ? null : Number(nextValue));
          }}
        />
        <div className="min-w-32 text-sm font-medium" aria-live="polite">
          {band?.label ?? "Choose a score"}
        </div>
      </div>
      <div className="text-muted mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        {ADVANCED_RATING_BANDS.slice(0, 5).map((item) => (
          <span key={item.min}>
            {item.min}-{item.max} {item.label}
          </span>
        ))}
        <span>0-74 Not recommended</span>
      </div>
    </FormField>
  );
}
