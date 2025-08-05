"use client";

import { HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/20/solid";
import BottleIcon from "@peated/web/assets/bottle.svg";
import PeatedGlyph from "@peated/web/assets/glyph.svg";
import { forwardRef, useEffect, useState } from "react";
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
    icon: HandThumbDownIcon,
    description: "Not my thing",
    className:
      "hover:bg-slate-800 data-[selected=true]:bg-slate-700 data-[selected=true]:border-slate-600",
  },
  {
    value: 1 as const,
    label: "Sip",
    icon: HandThumbUpIcon,
    description: "Enjoyable, would drink again",
    className:
      "hover:bg-slate-800 data-[selected=true]:bg-slate-700 data-[selected=true]:border-slate-600",
  },
  {
    value: 2 as const,
    label: "Savor",
    icon: HandThumbUpIcon,
    description: "Amazing, would seek out",
    isDouble: true,
    className:
      "hover:bg-slate-800 data-[selected=true]:bg-slate-700 data-[selected=true]:border-slate-600",
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

    // Update selectedValue when value prop changes
    useEffect(() => {
      setSelectedValue(value ?? null);
    }, [value]);

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
                "flex-1 rounded border border-slate-700 bg-slate-900 p-4 transition-all",
                "flex cursor-pointer flex-col items-center gap-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                option.className,
              )}
              title={option.description}
            >
              <div className="flex items-center gap-1">
                <option.icon className="h-8 w-8" />
                {option.isDouble && <option.icon className="h-8 w-8" />}
              </div>
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
