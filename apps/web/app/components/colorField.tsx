import { formatColor } from "@peated/server/lib/format";
import { COLOR_SCALE } from "@peated/server/src/constants";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
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
      min = "-1",
      max = "20",
      step = "1",
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
        <div className="flex flex-col">
          <div className="flex flex-1 gap-x-2">
            <div className="h-4 flex-1"></div>
            {COLOR_SCALE.map(([num, _, hexColor]) => {
              return (
                <div
                  key={num}
                  className={classNames(
                    "h-4 flex-1",
                    num === value ? "-my-2 h-6 px-2" : "",
                  )}
                  style={{
                    background: hexColor,
                  }}
                ></div>
              );
            })}
          </div>
          <input
            name={name}
            id={`f-${name}`}
            required={required}
            min={min}
            max={max}
            step={step}
            ref={ref}
            value={value}
            type="range"
            list={`m-${name}`}
            className="range range-color range-sm mb-6 block h-1 w-full cursor-pointer"
            {...props}
            onInput={(e) => {
              setValue(parseFloat((e as InputEvent).target.value));
            }}
            onChange={(e) => {
              setValue(parseFloat(e.target.value));
              onChange && onChange(e);
            }}
          />
        </div>
      </FormField>
    );
  },
);
