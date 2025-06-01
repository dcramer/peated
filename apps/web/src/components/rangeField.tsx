"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { forwardRef, useState } from "react";
import type { FieldError } from "react-hook-form";
import FormField from "./formField";

type Props = {
  name?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
  value?: number | null;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  error?: FieldError;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
};

type InputEvent = FormEvent<HTMLInputElement> & {
  target: {
    value: string;
  };
};

export default forwardRef<HTMLInputElement, Props>(
  (
    {
      name,
      helpText,
      label,
      required,
      className,
      min = "0.00",
      max = "5.00",
      step = "0.25",
      value: initialValue,
      error,
      onChange,
      ...props
    },
    ref
  ) => {
    const [value, setValue] = useState<number>(initialValue ?? 0);
    return (
      <FormField
        label={label}
        labelNote={
          <div className="text-sm font-medium">
            {!value || typeof value !== "number" ? (
              "Not Rated"
            ) : (
              <span className="text-highlight">{value.toFixed(2)}</span>
            )}
          </div>
        }
        htmlFor={`f-${name}`}
        required={required}
        helpText={helpText}
        error={error}
        className={className}
      >
        <input
          name={name}
          id={`f-${name}`}
          required={required}
          min={min}
          max={max}
          step={step}
          ref={ref}
          value={value.toFixed(2)}
          type="range"
          list={`m-${name}`}
          className="range range-sm mb-6 block h-1 w-full cursor-pointer"
          {...props}
          onInput={(e) => {
            setValue(Number.parseFloat((e as InputEvent).target.value));
          }}
          onChange={(e) => {
            setValue(Number.parseFloat(e.target.value));
            onChange && onChange(e);
          }}
        />
      </FormField>
    );
  }
);
