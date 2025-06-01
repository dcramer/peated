import type { ReactNode } from "react";

import { Switch } from "@headlessui/react";
import type { FieldValues, UseControllerProps } from "react-hook-form";
import { useController } from "react-hook-form";
import classNames from "../lib/classNames";
import FormField from "./formField";

type Props<T extends FieldValues> = {
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  error?: {
    message?: string;
  };
  className?: string;
} & UseControllerProps<T>;

export default function BooleanField<T extends FieldValues>({
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

  return (
    <FormField
      htmlFor={`f-${name}`}
      required={required}
      helpText={helpText}
      className={className}
      error={error}
    >
      <div className="flex items-center justify-between">
        <span className="flex flex-grow flex-col">
          <span className="font-semibold">{label}</span>
        </span>
        <Switch
          checked={Boolean(value)}
          onChange={onChange}
          className={classNames(
            value ? "bg-highlight" : "bg-slate-500",
            "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          )}
        >
          <span className="sr-only">Use setting</span>
          <span
            aria-hidden="true"
            className={classNames(
              value ? "translate-x-5" : "translate-x-0",
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            )}
          />
        </Switch>
      </div>
    </FormField>
  );
}
