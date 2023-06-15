import type { ReactNode } from "react";

import { COUNTRY_LIST } from "@peated/shared/constants";
import type {
  FieldValues,
  UseControllerProps} from "react-hook-form";
import {
  useController,
} from "react-hook-form";
import SelectField from "./selectField";

type Props<T extends FieldValues> = {
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
  value?: string | null;
  onChange?: (value: string) => void;
} & Omit<
  React.ComponentProps<typeof SelectField>,
  "options" | "onChange" | "multiple" | "endpoint" | "value"
> &
  UseControllerProps<T>;

function formatOption(c: string) {
  return {
    id: c,
    name: c,
  };
}

// basically the most significant producers
const MAJOR_COUNTRIES = new Set([
  "Scotland",
  "United States of America",
  "Canada",
  "Ireland",
  "Japan",
]);

export default function CountryField<T extends FieldValues>({
  helpText,
  label,
  required,
  className,
  error,
  ...props
}: Props<T>) {
  const {
    field: { name, value, onChange },
  } = useController<T>(props);

  const options = COUNTRY_LIST.map(formatOption);
  return (
    <SelectField
      label={label}
      name={name}
      value={value ? { id: value, name: value } : undefined}
      required={required}
      helpText={helpText}
      className={className}
      options={options}
      suggestedOptions={options.filter(({ id }) => MAJOR_COUNTRIES.has(id))}
      error={error}
      onChange={(value) => onChange && onChange(value ? value.name : "")}
    />
  );
}
