"use client";

import { forwardRef, useState } from "react";
import type { FieldError } from "react-hook-form";
import classNames from "../lib/classNames";
import FormField from "./formField";

type RatingValue = -1 | 1 | 2 | null;

type Props = {
  name?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  className?: string;
  value?: RatingValue;
  error?: FieldError;
  onChange?: (value: RatingValue) => void;
  disabled?: boolean;
};

const ratingOptions = [
  {
    value: -1 as const,
    label: "Pass",
    icon: "🚫",
    description: "Would not drink again",
    className:
      "hover:bg-red-50 data-[selected=true]:bg-red-100 data-[selected=true]:border-red-300",
  },
  {
    value: 1 as const,
    label: "Sip",
    icon: "🥃",
    description: "Enjoyable, would have occasionally",
    className:
      "hover:bg-yellow-50 data-[selected=true]:bg-yellow-100 data-[selected=true]:border-yellow-300",
  },
  {
    value: 2 as const,
    label: "Savor",
    icon: "🥃🥃",
    description: "Excellent, would seek out",
    className:
      "hover:bg-green-50 data-[selected=true]:bg-green-100 data-[selected=true]:border-green-300",
  },
];

export default forwardRef<HTMLDivElement, Props>(
  (
    {
      name,
      helpText,
      label = "Rating",
      required,
      className,
      value,
      error,
      onChange,
      disabled,
    },
    ref,
  ) => {
    const [selectedValue, setSelectedValue] = useState<RatingValue>(
      value ?? null,
    );

    const handleSelect = (newValue: RatingValue) => {
      if (disabled) return;

      // Toggle off if clicking the same value
      const finalValue = selectedValue === newValue ? null : newValue;
      setSelectedValue(finalValue);
      onChange?.(finalValue);
    };

    return (
      <FormField
        label={label}
        labelNote={
          selectedValue !== null && (
            <div className="text-highlight text-sm font-medium">
              {ratingOptions.find((o) => o.value === selectedValue)?.label}
            </div>
          )
        }
        htmlFor={`f-${name}`}
        required={required}
        helpText={helpText}
        error={error}
        className={className}
      >
        <div className="flex gap-3" ref={ref}>
          {ratingOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              data-selected={selectedValue === option.value}
              onClick={() => handleSelect(option.value)}
              className={classNames(
                "flex-1 rounded-lg border-2 border-slate-200 p-4 transition-all",
                "flex cursor-pointer flex-col items-center gap-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                option.className,
              )}
              title={option.description}
            >
              <div className="text-2xl">{option.icon}</div>
              <div className="font-semibold">{option.label}</div>
              <div className="text-muted text-center text-xs">
                {option.description}
              </div>
            </button>
          ))}
        </div>
        {selectedValue !== null && (
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="text-muted hover:text-highlight mt-2 text-sm"
            disabled={disabled}
          >
            Clear rating
          </button>
        )}
      </FormField>
    );
  },
);
