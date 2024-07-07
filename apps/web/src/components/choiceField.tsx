"use client";

import { Field, Label, Radio, RadioGroup } from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/24/outline";
import classNames from "@peated/web/lib/classNames";
import type { ReactNode } from "react";
import type { FieldValues, UseControllerProps } from "react-hook-form";
import { useController } from "react-hook-form";
import FormField from "./formField";

type Choice = {
  id: string;
  name: string;
  helpText?: string;
};

type Props<T extends FieldValues> = {
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  error?: {
    message?: string;
  };
  className?: string;
  choices: Choice[];
} & UseControllerProps<T>;

export default function ChoiceField<T extends FieldValues>({
  helpText,
  label,
  required,
  className,
  error,
  choices,
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
      label={label}
    >
      <RadioGroup value={value} onChange={onChange}>
        {choices.map((choice) => {
          return (
            <Field key={choice.id}>
              <Radio
                value={choice.id}
                className="group relative flex cursor-pointer px-5 py-4 text-white focus:outline-none"
              >
                {({ active, checked }) => (
                  <>
                    <div className="flex w-full items-center justify-between space-x-4">
                      <div
                        className={classNames(
                          "h-6 w-6 shrink-0 border",
                          checked ? "text-highlight border-highlight" : "",
                        )}
                      >
                        <CheckIcon
                          className={classNames(
                            "h-full w-full group-hover:block",
                            checked ? "block" : "text-light hidden",
                          )}
                        />
                      </div>
                      <div className="flex flex-auto items-center">
                        <div className="text-sm">
                          <Label
                            as="p"
                            className={`font-mediumbold  ${
                              checked
                                ? "text-highlight"
                                : "text-light hover:text-white"
                            }`}
                          >
                            {choice.name}
                          </Label>
                          <span
                            className={`inline ${
                              checked
                                ? "text-highlight"
                                : "text-light hover:text-white"
                            }`}
                          >
                            {choice.helpText}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </Radio>
            </Field>
          );
        })}
      </RadioGroup>
    </FormField>
  );
}
