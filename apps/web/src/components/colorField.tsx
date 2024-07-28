"use client";

import { COLOR_SCALE } from "@peated/server/constants";
import { formatColor } from "@peated/server/lib/format";
import type { ReactNode } from "react";
import { forwardRef, useState } from "react";
import type { FieldError } from "react-hook-form";
import classNames from "../lib/classNames";
import FormField from "./formField";

type Props = {
  name?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
  value?: number | null;
  error?: FieldError;
  onChange?: (value: number | undefined) => void;
};

export default forwardRef<HTMLInputElement, Props>(
  (
    {
      name,
      helpText,
      label,
      required,
      className,
      value: initialValue,
      error,
      onChange,
      ...props
    },
    ref,
  ) => {
    const [value, setValue] = useState<number>(initialValue ?? -1);
    return (
      <FormField
        label={label}
        labelNote={
          <div className="text-sm font-medium">
            {value === -1 || typeof value !== "number" ? (
              "Unsure"
            ) : (
              <span className="text-white">{formatColor(value)}</span>
            )}
          </div>
        }
        htmlFor={`f-${name}`}
        required={required}
        helpText={helpText}
        error={error}
        className={className}
      >
        <div className="flex flex-1 items-center gap-x-1 sm:gap-x-2">
          <button
            className={classNames(
              "pointer text-muted border-muted h-8 flex-1 border",
              value === -1 ? "h-12 px-2" : "",
            )}
            onClick={(e) => {
              e.preventDefault();
              onChange && onChange(undefined);
              setValue(-1);
            }}
          >
            ?
          </button>
          {COLOR_SCALE.map(([num, _, hexColor]) => {
            return (
              <button
                key={num}
                className={classNames(
                  "pointer h-8 flex-1",
                  num === value ? "h-12 px-2" : "",
                )}
                onClick={(e) => {
                  e.preventDefault();
                  setValue(num);
                  onChange && onChange(num);
                }}
                style={{
                  background: hexColor,
                }}
              ></button>
            );
          })}
          <input
            type="hidden"
            name={name}
            id={`f-${name}`}
            value={value}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              setValue(value);
              onChange && onChange(value);
            }}
          />
        </div>
      </FormField>
    );
  },
);
