import { FormEvent, ReactNode, useState } from "react";

import FormField from "./formField";

type Props = {
  name?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  factor?: number;
  onChange?: (value: number) => void;
};

type InputEvent = FormEvent<HTMLInputElement> & {
  target: {
    value: string;
  };
};

export default ({
  name,
  helpText,
  label,
  required,
  className,
  min = 0,
  max = 20,
  step = 1,
  factor = 4,
  value: initialValue,
  onChange,
  ...props
}: Props) => {
  const [value, setValue] = useState<number>(initialValue || 0);
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
      className={className}
    >
      <input
        name={name}
        id={`f-${name}`}
        required={required}
        min={min}
        max={max}
        step={step}
        onInput={(e) => {
          setValue(parseInt((e as InputEvent).target.value, 10) / factor);
        }}
        onChange={(e) => {
          const value = parseInt(e.target.value, 10) / factor;
          setValue(value);
          onChange && onChange(value);
        }}
        value={value * factor}
        type="range"
        className="range range-sm mb-6 block h-1 w-full cursor-pointer appearance-none rounded-lg border-0 bg-gray-200 bg-inherit p-0"
        {...props}
      />
    </FormField>
  );
};
