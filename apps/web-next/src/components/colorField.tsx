import { formatColor } from "@peated/server/lib/format";
import { COLOR_SCALE } from "@peated/server/src/constants";
import type { FormEvent, ReactNode } from "react";
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
          <div
            className="cursor h-4 flex-1"
            onClick={(e) => {
              e.preventDefault();
              onChange && onChange(undefined);
              setValue(-1);
            }}
          ></div>
          {COLOR_SCALE.map(([num, _, hexColor]) => {
            return (
              <button
                key={num}
                className={classNames(
                  "pointer h-4 flex-1",
                  num === value ? "h-8 px-2" : "",
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
              const value = Number(e.target.value);
              setValue(value);
              onChange && onChange(value);
            }}
          />
        </div>
      </FormField>
    );
  },
);
