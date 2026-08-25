"use client";

import type { RatingSystem } from "@peated/server/constants";
import Button from "./button";

export default function RatingSystemPicker({
  value,
  onChange,
}: {
  value: RatingSystem;
  onChange: (value: RatingSystem) => void;
}) {
  return (
    <div className="flex gap-2" role="group" aria-label="Rating system">
      <Button
        type="button"
        active={value === "simple"}
        aria-pressed={value === "simple"}
        onClick={() => onChange("simple")}
      >
        Simple
      </Button>
      <Button
        type="button"
        active={value === "advanced"}
        aria-pressed={value === "advanced"}
        onClick={() => onChange("advanced")}
      >
        100-point
      </Button>
    </div>
  );
}
